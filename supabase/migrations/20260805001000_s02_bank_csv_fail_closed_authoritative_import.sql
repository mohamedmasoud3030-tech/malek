-- ============================================================================
-- S02-T07/T08 Bank CSV import fail-closed authoritative server contract
--
-- Forward-only hardening for public.import_bank_statement_batch_atomic(jsonb).
-- Scope: bank_statement_imports / bank_statement_lines only. No accounting posts.
-- ============================================================================

begin;

alter table public.bank_statement_imports
  add column if not exists file_name text,
  add column if not exists file_fingerprint text,
  add column if not exists file_size integer,
  add column if not exists total_rows integer not null default 0,
  add column if not exists accepted_rows integer not null default 0,
  add column if not exists rejected_rows integer not null default 0,
  add column if not exists duplicate_rows integer not null default 0,
  add column if not exists possible_duplicate_rows integer not null default 0,
  add column if not exists status text not null default 'completed',
  add column if not exists error_summary jsonb not null default '{}'::jsonb,
  add column if not exists processed_at timestamptz;

alter table public.bank_statement_lines
  add column if not exists fingerprint text,
  add column if not exists balance numeric(14,3),
  add column if not exists currency text not null default 'OMR',
  add column if not exists external_reference text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bank_statement_lines'
      and column_name = 'balance'
      and numeric_scale is not null
      and numeric_scale < 3
  ) then
    alter table public.bank_statement_lines alter column balance type numeric(14,3) using round(balance::numeric, 3);
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bank_statement_imports_status_chk2') then
    alter table public.bank_statement_imports
      add constraint bank_statement_imports_status_chk2
      check (status in ('pending','completed','failed','duplicate','processing'));
  end if;
exception when duplicate_object then null;
end $$;

create unique index if not exists ux_bank_imports_company_fingerprint
  on public.bank_statement_imports (company_id, file_fingerprint)
  where file_fingerprint is not null and deleted_at is null;

create unique index if not exists ux_bank_lines_company_fingerprint
  on public.bank_statement_lines (company_id, fingerprint)
  where fingerprint is not null and deleted_at is null;

create index if not exists idx_bank_lines_possible_dup
  on public.bank_statement_lines (company_id, bank_account_id, transaction_date, amount)
  where deleted_at is null;

create or replace function public.import_bank_statement_batch_atomic(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c_max_file_size integer := 5 * 1024 * 1024;
  c_max_rows integer := 10000;
  c_max_text_length integer := 512;
  c_max_file_name_length integer := 255;

  v_company_id uuid;
  v_bank_account_id uuid;
  v_file_name text;
  v_client_fingerprint text;
  v_server_fingerprint text;
  v_file_size integer;
  v_rows jsonb;
  v_total integer;
  v_existing_import public.bank_statement_imports%rowtype;
  v_import public.bank_statement_imports%rowtype;
  v_row jsonb;
  v_idx integer;
  v_transaction_date date;
  v_date_text text;
  v_amount numeric;
  v_amount_text text;
  v_description text;
  v_reference text;
  v_balance numeric;
  v_balance_text text;
  v_currency text;
  v_row_fingerprint text;
  v_seen_fps text[] := '{}';
  v_possible integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_canonical_rows text[] := '{}';
  v_line_id uuid;
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

  begin
    v_bank_account_id := nullif(payload->>'bank_account_id','')::uuid;
  exception when others then
    raise exception 'bank_account_id must be a valid uuid.' using errcode='22023';
  end;
  v_file_name := nullif(payload->>'file_name','');
  v_client_fingerprint := nullif(payload->>'file_fingerprint','');
  begin
    v_file_size := nullif(payload->>'file_size','')::integer;
  exception when others then
    raise exception 'file_size must be an integer.' using errcode='22023';
  end;
  v_rows := payload->'rows';

  if v_bank_account_id is null then
    raise exception 'bank_account_id is required.' using errcode='22023';
  end if;
  if v_file_name is not null and length(v_file_name) > c_max_file_name_length then
    raise exception 'file_name exceeds % characters.', c_max_file_name_length using errcode='22023';
  end if;
  if v_file_size is null or v_file_size < 0 or v_file_size > c_max_file_size then
    raise exception 'file_size exceeds server limit of % bytes.', c_max_file_size using errcode='22023';
  end if;
  if v_rows is null or jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) = 0 then
    raise exception 'No rows to import.' using errcode='22023';
  end if;

  v_total := jsonb_array_length(v_rows);
  if v_total > c_max_rows then
    raise exception 'row count % exceeds server limit %.', v_total, c_max_rows using errcode='22023';
  end if;

  if not exists (
    select 1 from public.bank_accounts
    where id = v_bank_account_id
      and company_id = v_company_id
      and deleted_at is null
  ) then
    raise exception 'Bank account not found or not in your company.' using errcode='42501';
  end if;

  -- Validation pass: collect every row error and compute canonical identity before any write.
  for v_idx in 0..v_total-1 loop
    v_row := v_rows->v_idx;
    v_date_text := nullif(v_row->>'transaction_date','');
    v_amount_text := nullif(v_row->>'amount','');
    v_description := trim(both ' ' from coalesce(v_row->>'description',''));
    v_reference := trim(both ' ' from coalesce(v_row->>'reference',''));
    v_balance_text := nullif(v_row->>'balance','');
    v_currency := upper(trim(both ' ' from coalesce(v_row->>'currency','OMR')));

    if v_row ? 'debit' and nullif(v_row->>'debit','') is not null and v_row ? 'credit' and nullif(v_row->>'credit','') is not null then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'amount', 'code', 'debit_credit_conflict');
      continue;
    end if;

    if v_date_text is null or v_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'transaction_date', 'code', 'invalid_date');
      continue;
    end if;
    begin
      v_transaction_date := v_date_text::date;
      if to_char(v_transaction_date, 'YYYY-MM-DD') <> v_date_text then
        v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'transaction_date', 'code', 'invalid_date');
        continue;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'transaction_date', 'code', 'invalid_date');
      continue;
    end;

    if v_amount_text is null or v_amount_text !~ '^-?\d+(\.\d{1,3})?$' then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'amount', 'code', 'invalid_amount');
      continue;
    end if;
    begin
      v_amount := v_amount_text::numeric;
      if v_amount = 0 or v_amount <> round(v_amount, 3) then
        v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'amount', 'code', 'invalid_amount');
        continue;
      end if;
    exception when others then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'amount', 'code', 'invalid_amount');
      continue;
    end;

    if v_currency <> 'OMR' then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'currency', 'code', 'currency_not_omr');
      continue;
    end if;

    if length(v_description) = 0 then
      v_description := 'حركة مستوردة';
    end if;
    if length(v_description) > c_max_text_length or length(v_reference) > c_max_text_length then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'text', 'code', 'text_too_long');
      continue;
    end if;

    v_balance := null;
    if v_balance_text is not null then
      if v_balance_text !~ '^-?\d+(\.\d{1,3})?$' then
        v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'balance', 'code', 'invalid_balance');
        continue;
      end if;
      v_balance := v_balance_text::numeric;
    end if;

    v_row_fingerprint := md5(
      'bank-line-v1|' || v_company_id::text || '|' || v_bank_account_id::text || '|' ||
      v_date_text || '|' || to_char(v_amount, 'FM9999999999990.000') || '|OMR|' ||
      lower(v_reference) || '|' || lower(v_description)
    );

    if v_row_fingerprint = any(v_seen_fps) then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'fingerprint', 'code', 'exact_duplicate_in_file');
      continue;
    end if;
    v_seen_fps := array_append(v_seen_fps, v_row_fingerprint);

    if exists (
      select 1 from public.bank_statement_lines
      where company_id = v_company_id
        and bank_account_id = v_bank_account_id
        and fingerprint = v_row_fingerprint
        and deleted_at is null
    ) then
      v_errors := v_errors || jsonb_build_object('row', v_idx + 1, 'field', 'fingerprint', 'code', 'exact_duplicate_existing_line');
      continue;
    end if;

    if exists (
      select 1 from public.bank_statement_lines
      where company_id = v_company_id
        and bank_account_id = v_bank_account_id
        and transaction_date = v_transaction_date
        and amount = v_amount
        and fingerprint <> v_row_fingerprint
        and deleted_at is null
    ) then
      v_possible := v_possible + 1;
    end if;

    v_canonical_rows := array_append(
      v_canonical_rows,
      v_date_text || '|' || to_char(v_amount, 'FM9999999999990.000') || '|OMR|' || lower(v_reference) || '|' || lower(v_description) || '|' || coalesce(to_char(v_balance, 'FM9999999999990.000'), '')
    );
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'Bank CSV import rejected fail-closed: %', v_errors::text using errcode='22023';
  end if;

  v_server_fingerprint := md5(
    'bank-import-v1|' || v_company_id::text || '|' || v_bank_account_id::text || '|' || array_to_string(v_canonical_rows, E'\n')
  );

  -- Idempotency lock makes concurrent retry converge to one batch.
  perform pg_advisory_xact_lock(hashtext(v_company_id::text || '|' || v_bank_account_id::text || '|' || v_server_fingerprint));

  select * into v_existing_import
  from public.bank_statement_imports
  where company_id = v_company_id
    and bank_account_id = v_bank_account_id
    and file_fingerprint = v_server_fingerprint
    and deleted_at is null
  limit 1;

  if found then
    return jsonb_build_object(
      'id', v_existing_import.id,
      'reference', v_existing_import.reference,
      'bank_account_id', v_existing_import.bank_account_id,
      'file_name', v_existing_import.file_name,
      'file_fingerprint', v_existing_import.file_fingerprint,
      'client_file_fingerprint', v_client_fingerprint,
      'total_rows', v_existing_import.total_rows,
      'accepted_rows', v_existing_import.accepted_rows,
      'rejected_rows', v_existing_import.rejected_rows,
      'duplicate_rows', v_existing_import.duplicate_rows,
      'possible_duplicate_rows', v_existing_import.possible_duplicate_rows,
      'status', v_existing_import.status,
      'is_duplicate_file', true
    );
  end if;

  insert into public.bank_statement_imports (
    company_id, bank_account_id, statement_name, file_name, file_fingerprint,
    file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
    possible_duplicate_rows, status, error_summary, processed_at, created_by
  ) values (
    v_company_id, v_bank_account_id,
    coalesce(v_file_name, 'استيراد ' || to_char(now(), 'YYYY-MM-DD')),
    v_file_name, v_server_fingerprint, v_file_size, v_total, v_total, 0, 0,
    v_possible, 'completed',
    jsonb_build_object(
      'server_authoritative', true,
      'client_file_fingerprint', v_client_fingerprint,
      'possible_duplicate_rows', v_possible,
      'limits', jsonb_build_object('max_file_size', c_max_file_size, 'max_rows', c_max_rows, 'max_text_length', c_max_text_length)
    ),
    now(), auth.uid()
  ) returning * into v_import;

  for v_idx in 0..v_total-1 loop
    v_row := v_rows->v_idx;
    v_date_text := v_row->>'transaction_date';
    v_transaction_date := v_date_text::date;
    v_amount := (v_row->>'amount')::numeric;
    v_description := trim(both ' ' from coalesce(v_row->>'description',''));
    if length(v_description) = 0 then v_description := 'حركة مستوردة'; end if;
    v_reference := nullif(trim(both ' ' from coalesce(v_row->>'reference','')), '');
    v_balance := nullif(v_row->>'balance','')::numeric;

    v_row_fingerprint := md5(
      'bank-line-v1|' || v_company_id::text || '|' || v_bank_account_id::text || '|' ||
      v_date_text || '|' || to_char(v_amount, 'FM9999999999990.000') || '|OMR|' ||
      lower(coalesce(v_reference, '')) || '|' || lower(v_description)
    );

    insert into public.bank_statement_lines (
      company_id, import_id, bank_account_id, transaction_date, description,
      reference, amount, balance, currency, external_reference, fingerprint, status
    ) values (
      v_company_id, v_import.id, v_bank_account_id, v_transaction_date, v_description,
      v_reference, v_amount, v_balance, 'OMR', v_reference, v_row_fingerprint, 'unmatched'
    ) returning id into v_line_id;
  end loop;

  return jsonb_build_object(
    'id', v_import.id,
    'reference', v_import.reference,
    'bank_account_id', v_import.bank_account_id,
    'file_name', v_import.file_name,
    'file_fingerprint', v_import.file_fingerprint,
    'client_file_fingerprint', v_client_fingerprint,
    'total_rows', v_import.total_rows,
    'accepted_rows', v_import.accepted_rows,
    'rejected_rows', v_import.rejected_rows,
    'duplicate_rows', v_import.duplicate_rows,
    'possible_duplicate_rows', v_import.possible_duplicate_rows,
    'status', v_import.status,
    'is_duplicate_file', false
  );
end;
$$;

alter function public.import_bank_statement_batch_atomic(jsonb) owner to postgres;
revoke all on function public.import_bank_statement_batch_atomic(jsonb) from public, anon;
grant execute on function public.import_bank_statement_batch_atomic(jsonb) to authenticated, service_role;
comment on function public.import_bank_statement_batch_atomic(jsonb) is 'S02 fail-closed authoritative bank CSV import: validates all rows before atomic write, recomputes counts and deterministic fingerprint, idempotent by company/account/content. No accounting postings.';

commit;
