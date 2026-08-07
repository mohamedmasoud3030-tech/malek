-- ============================================================================
-- S02-T07/T08 follow-up: bank CSV server-side import guards.
--
-- The browser parser is not trusted for financial/operational writes. This
-- migration keeps the existing atomic SECURITY DEFINER import path, then adds
-- server-side file/row limits, OMR-only currency enforcement, 3-decimal scale
-- enforcement, debit+credit ambiguity rejection and deterministic balance
-- validation before any batch row is inserted.
--
-- Rollback: supabase/rollback/20260807_rollback_s02_bank_csv_import_server_guards.sql
-- ============================================================================

begin;

create or replace function public.import_bank_statement_batch_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_bank_account_id uuid;
  v_file_name text;
  v_file_fingerprint text;
  v_file_size integer;
  v_rows jsonb;
  v_total integer;
  v_existing_import public.bank_statement_imports%rowtype;
  v_import public.bank_statement_imports%rowtype;
  v_row jsonb;
  v_idx integer;
  v_transaction_date date;
  v_amount numeric;
  v_description text;
  v_reference text;
  v_balance numeric;
  v_currency text;
  v_fingerprint text;
  v_accepted integer := 0;
  v_duplicate integer := 0;
  v_possible integer := 0;
  v_existing_fps text[];
  v_seen_fps text[] := '{}';
  v_inserted_fps text[] := '{}';
  v_date_str text;
  v_amount_text text;
  v_dummy uuid;
  v_max_file_size integer := 5 * 1024 * 1024;
  v_max_rows integer := 5000;
  v_debit_text text;
  v_credit_text text;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;
  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Only managers can import bank statements.' using errcode = '42501';
  end if;

  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Company context is required.' using errcode = '42501';
  end if;

  v_bank_account_id := nullif(payload->>'bank_account_id','')::uuid;
  v_file_name := nullif(payload->>'file_name','');
  v_file_fingerprint := nullif(payload->>'file_fingerprint','');
  v_file_size := nullif(payload->>'file_size','')::integer;
  v_rows := payload->'rows';

  if v_bank_account_id is null then
    raise exception 'bank_account_id is required.' using errcode='22023';
  end if;
  if v_file_fingerprint is null then
    raise exception 'file_fingerprint is required.' using errcode='22023';
  end if;
  if v_file_size is null then
    raise exception 'file_size is required.' using errcode='22023';
  end if;
  if v_file_size <= 0 then
    raise exception 'file_size must be greater than zero.' using errcode='22023';
  end if;
  if v_file_size > v_max_file_size then
    raise exception 'file_size exceeds % byte limit.', v_max_file_size using errcode='22023';
  end if;
  if v_rows is null or jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows)=0 then
    raise exception 'No rows to import.' using errcode='22023';
  end if;

  v_total := jsonb_array_length(v_rows);

  if v_total > v_max_rows then
    raise exception 'Row count exceeds % row limit.', v_max_rows using errcode='22023';
  end if;

  if not exists (
    select 1 from public.bank_accounts
    where id = v_bank_account_id
      and company_id = v_company_id
      and deleted_at is null
  ) then
    raise exception 'Bank account not found or not in your company.' using errcode='42501';
  end if;

  select * into v_existing_import
  from public.bank_statement_imports
  where company_id = v_company_id
    and file_fingerprint = v_file_fingerprint
    and deleted_at is null
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing_import.id,
      'reference', v_existing_import.reference,
      'bank_account_id', v_existing_import.bank_account_id,
      'file_name', v_existing_import.file_name,
      'file_fingerprint', v_existing_import.file_fingerprint,
      'total_rows', v_existing_import.total_rows,
      'accepted_rows', v_existing_import.accepted_rows,
      'rejected_rows', v_existing_import.rejected_rows,
      'duplicate_rows', v_existing_import.duplicate_rows,
      'possible_duplicate_rows', v_existing_import.possible_duplicate_rows,
      'status', v_existing_import.status,
      'is_duplicate_file', true
    );
  end if;

  select coalesce(array_agg(fingerprint), '{}') into v_existing_fps
  from public.bank_statement_lines
  where company_id = v_company_id
    and bank_account_id = v_bank_account_id
    and deleted_at is null
    and fingerprint is not null;

  -- First pass: validate and compute counts
  for v_idx in 0..v_total-1 loop
    v_row := v_rows->v_idx;
    v_date_str := v_row->>'transaction_date';
    v_amount_text := v_row->>'amount';
    v_debit_text := nullif(trim(both ' ' from coalesce(v_row->>'debit','')), '');
    v_credit_text := nullif(trim(both ' ' from coalesce(v_row->>'credit','')), '');

    if v_debit_text is not null and v_credit_text is not null then
      raise exception 'Rows must not contain both debit and credit at row %', v_idx+1 using errcode='22023';
    end if;

    begin
      v_transaction_date := v_date_str::date;
    exception when others then
      raise exception 'Invalid transaction_date at row %: %', v_idx+1, v_date_str using errcode='22023';
    end;

    -- Cast errors keep their own message; the zero guard must never be
    -- swallowed by the cast handler (S02 deterministic 22023 contract).
    begin
      v_amount := v_amount_text::numeric;
    exception when others then
      raise exception 'Invalid amount at row %: %', v_idx+1, v_amount_text using errcode='22023';
    end;
    if v_amount = 0 then
      raise exception 'Amount must be non-zero at row %', v_idx+1 using errcode='22023';
    end if;
    if round(v_amount, 3) <> v_amount then
      raise exception 'Amount must have at most 3 decimals at row %', v_idx+1 using errcode='22023';
    end if;

    v_description := trim(both ' ' from coalesce(v_row->>'description',''));
    if v_description = '' then v_description := 'حركة مستوردة'; end if;
    v_reference := lower(trim(both ' ' from coalesce(v_row->>'reference','')));
    v_currency := upper(trim(both ' ' from coalesce(v_row->>'currency','OMR')));
    if v_currency !~ '^[A-Z]{3}$' then
      raise exception 'Invalid currency at row %: %', v_idx+1, v_currency using errcode='22023';
    end if;
    if v_currency <> 'OMR' then
      raise exception 'Unsupported currency at row %: %', v_idx+1, v_currency using errcode='22023';
    end if;

    if nullif(v_row->>'balance','') is not null then
      begin
        v_balance := (v_row->>'balance')::numeric;
      exception when others then
        raise exception 'Invalid balance at row %: %', v_idx+1, v_row->>'balance' using errcode='22023';
      end;
      if round(v_balance, 3) <> v_balance then
        raise exception 'Balance must have at most 3 decimals at row %', v_idx+1 using errcode='22023';
      end if;
    end if;

    v_fingerprint := md5(
      coalesce(v_company_id::text,'') || '|' ||
      coalesce(v_bank_account_id::text,'') || '|' ||
      coalesce(v_transaction_date::text,'') || '|' ||
      coalesce(to_char(v_amount, 'FM9999999999990.000'),'') || '|' ||
      coalesce(v_currency,'OMR') || '|' ||
      coalesce(v_reference,'') || '|' ||
      lower(coalesce(v_description,''))
    );

    if v_fingerprint = any(v_seen_fps) then
      v_duplicate := v_duplicate + 1;
    else
      v_seen_fps := array_append(v_seen_fps, v_fingerprint);
      if v_fingerprint = any(v_existing_fps) then
        v_duplicate := v_duplicate + 1;
      else
        if exists (
          select 1 from public.bank_statement_lines
          where company_id = v_company_id
            and bank_account_id = v_bank_account_id
            and transaction_date = v_transaction_date
            and amount = v_amount
            and deleted_at is null
          limit 1
        ) then
          v_possible := v_possible + 1;
        end if;
        v_accepted := v_accepted + 1;
      end if;
    end if;
  end loop;

  -- Insert import batch
  begin
    insert into public.bank_statement_imports (
      company_id, bank_account_id, statement_name, file_name, file_fingerprint,
      file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
      possible_duplicate_rows, status, error_summary, processed_at, created_by
    ) values (
      v_company_id, v_bank_account_id,
      coalesce(v_file_name, 'استيراد ' || to_char(now(),'YYYY-MM-DD')),
      v_file_name, v_file_fingerprint, v_file_size, v_total, v_accepted, 0,
      v_duplicate, v_possible,
      case when v_accepted = 0 and v_duplicate > 0 then 'duplicate' else 'completed' end,
      jsonb_build_object('duplicate_rows', v_duplicate, 'possible_duplicate_rows', v_possible, 'accepted_rows', v_accepted),
      now(), auth.uid()
    ) returning * into v_import;
  exception when unique_violation then
    select * into v_existing_import
    from public.bank_statement_imports
    where company_id = v_company_id and file_fingerprint = v_file_fingerprint and deleted_at is null limit 1;
    if found then
      return jsonb_build_object(
        'id', v_existing_import.id, 'reference', v_existing_import.reference,
        'bank_account_id', v_existing_import.bank_account_id,
        'file_name', v_existing_import.file_name,
        'file_fingerprint', v_existing_import.file_fingerprint,
        'total_rows', v_existing_import.total_rows,
        'accepted_rows', v_existing_import.accepted_rows,
        'rejected_rows', v_existing_import.rejected_rows,
        'duplicate_rows', v_existing_import.duplicate_rows,
        'possible_duplicate_rows', v_existing_import.possible_duplicate_rows,
        'status', v_existing_import.status, 'is_duplicate_file', true
      );
    else raise; end if;
  end;

  -- Insert lines. Any real line error aborts the whole transaction — an
  -- invalid batch must write nothing (no silent partial success).
  v_seen_fps := '{}';
  if v_accepted > 0 then
    for v_idx in 0..v_total-1 loop
      v_row := v_rows->v_idx;
      v_transaction_date := (v_row->>'transaction_date')::date;
      v_amount := (v_row->>'amount')::numeric;
      v_description := trim(both ' ' from coalesce(v_row->>'description','حركة مستوردة'));
      v_reference := nullif(trim(both ' ' from coalesce(v_row->>'reference','')), '');
      v_balance := nullif(v_row->>'balance','')::numeric;
      v_currency := upper(trim(both ' ' from coalesce(v_row->>'currency','OMR')));

      v_fingerprint := md5(
        coalesce(v_company_id::text,'') || '|' ||
        coalesce(v_bank_account_id::text,'') || '|' ||
        coalesce(v_transaction_date::text,'') || '|' ||
        coalesce(to_char(v_amount, 'FM9999999999990.000'),'') || '|' ||
        coalesce(v_currency,'OMR') || '|' ||
        lower(coalesce(v_reference,'')) || '|' ||
        lower(coalesce(v_description,''))
      );

      if v_fingerprint = any(v_seen_fps) then continue; end if;
      v_seen_fps := array_append(v_seen_fps, v_fingerprint);
      if v_fingerprint = any(v_existing_fps) then continue; end if;
      if v_fingerprint = any(v_inserted_fps) then continue; end if;

      insert into public.bank_statement_lines (
        company_id, import_id, bank_account_id, transaction_date, description,
        reference, amount, balance, currency, external_reference, fingerprint, status
      ) values (
        v_company_id, v_import.id, v_bank_account_id, v_transaction_date, v_description,
        v_reference, v_amount, v_balance, v_currency, v_reference, v_fingerprint, 'unmatched'
      )
      on conflict (company_id, fingerprint) where fingerprint is not null and deleted_at is null do nothing
      returning id into v_dummy;
      if found then
        v_inserted_fps := array_append(v_inserted_fps, v_fingerprint);
      end if;
    end loop;
  end if;

  select * into v_import from public.bank_statement_imports where id = v_import.id;

  return jsonb_build_object(
    'id', v_import.id, 'reference', v_import.reference,
    'bank_account_id', v_import.bank_account_id,
    'file_name', v_import.file_name,
    'file_fingerprint', v_import.file_fingerprint,
    'total_rows', v_import.total_rows,
    'accepted_rows', v_import.accepted_rows,
    'rejected_rows', v_import.rejected_rows,
    'duplicate_rows', v_import.duplicate_rows,
    'possible_duplicate_rows', v_import.possible_duplicate_rows,
    'status', v_import.status, 'is_duplicate_file', false
  );
end;
$$;

alter function public.import_bank_statement_batch_atomic(jsonb) owner to postgres;
revoke all on function public.import_bank_statement_batch_atomic(jsonb) from public, anon;
grant execute on function public.import_bank_statement_batch_atomic(jsonb) to authenticated, service_role;
comment on function public.import_bank_statement_batch_atomic(jsonb) is 'S02: atomic staged bank CSV import with idempotency, duplicate detection, OMR 3dp precision, server file/row limits, deterministic 22023 error contract, OMR-only rows and company isolation. Batch and lines commit together; an invalid batch writes nothing. No accounting postings.';

commit;
