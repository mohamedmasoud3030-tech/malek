-- Bank CSV import integrity follow-up.
--
-- Forward-only replacement of the Stage 4 import boundary. The historical
-- migration remains unchanged. This migration makes the persisted batch agree
-- with rows actually inserted, rejects client-side partial imports, adds server
-- limits, and upgrades bank reconciliation amounts to OMR 0.001 precision.

begin;

alter table public.bank_accounts
  alter column opening_balance type numeric(18,3)
  using round(opening_balance::numeric, 3);

alter table public.bank_statement_lines
  alter column amount type numeric(18,3)
  using round(amount::numeric, 3),
  alter column balance type numeric(18,3)
  using round(balance::numeric, 3);

alter table public.bank_reconciliation_matches
  alter column matched_amount type numeric(18,3)
  using round(matched_amount::numeric, 3);

alter table public.bank_statement_imports
  add column if not exists normalized_payload_fingerprint text;

create unique index if not exists ux_bank_imports_company_account_payload
  on public.bank_statement_imports (
    company_id,
    bank_account_id,
    normalized_payload_fingerprint
  )
  where normalized_payload_fingerprint is not null
    and deleted_at is null;

alter table public.bank_statement_imports
  drop constraint if exists bank_statement_imports_count_integrity_check;
alter table public.bank_statement_imports
  add constraint bank_statement_imports_count_integrity_check check (
    total_rows >= 0
    and accepted_rows >= 0
    and rejected_rows >= 0
    and duplicate_rows >= 0
    and possible_duplicate_rows >= 0
    and accepted_rows + duplicate_rows + rejected_rows <= total_rows
    and possible_duplicate_rows <= accepted_rows
  ) not valid;
alter table public.bank_statement_imports
  validate constraint bank_statement_imports_count_integrity_check;

create or replace function public.bank_statement_line_fingerprint(
  p_company_id uuid,
  p_bank_account_id uuid,
  p_transaction_date date,
  p_amount numeric,
  p_currency text,
  p_reference text,
  p_description text
)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select encode(
    extensions.digest(
      convert_to(
        coalesce(p_company_id::text, '') || '|' ||
        coalesce(p_bank_account_id::text, '') || '|' ||
        coalesce(p_transaction_date::text, '') || '|' ||
        to_char(round(coalesce(p_amount, 0), 3), 'FM9999999999999990.000') || '|' ||
        upper(coalesce(nullif(btrim(p_currency), ''), 'OMR')) || '|' ||
        lower(coalesce(btrim(p_reference), '')) || '|' ||
        lower(coalesce(nullif(btrim(p_description), ''), 'حركة مستوردة')),
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  )
$$;

alter function public.bank_statement_line_fingerprint(uuid, uuid, date, numeric, text, text, text) owner to postgres;
revoke all on function public.bank_statement_line_fingerprint(uuid, uuid, date, numeric, text, text, text) from public, anon;
grant execute on function public.bank_statement_line_fingerprint(uuid, uuid, date, numeric, text, text, text) to authenticated, service_role;

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
  v_payload_fingerprint text;
  v_file_size integer;
  v_rows jsonb;
  v_total integer;
  v_source_total integer;
  v_client_rejected integer;
  v_existing_import public.bank_statement_imports%rowtype;
  v_import public.bank_statement_imports%rowtype;
  v_row jsonb;
  v_idx integer;
  v_transaction_date date;
  v_amount numeric(18,3);
  v_description text;
  v_reference text;
  v_balance numeric(18,3);
  v_currency text;
  v_fingerprint text;
  v_duplicate integer := 0;
  v_possible integer := 0;
  v_inserted integer := 0;
  v_existing_fps text[] := '{}';
  v_seen_fps text[] := '{}';
  v_date_str text;
  v_amount_text text;
  v_inserted_id uuid;
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

  v_bank_account_id := nullif(payload->>'bank_account_id', '')::uuid;
  v_file_name := nullif(btrim(payload->>'file_name'), '');
  v_file_fingerprint := lower(nullif(btrim(payload->>'file_fingerprint'), ''));
  v_file_size := nullif(payload->>'file_size', '')::integer;
  v_rows := payload->'rows';
  v_source_total := nullif(payload->>'source_total_rows', '')::integer;
  v_client_rejected := coalesce(nullif(payload->>'rejected_rows', '')::integer, 0);

  if v_bank_account_id is null then
    raise exception 'bank_account_id is required.' using errcode = '22023';
  end if;
  if v_file_fingerprint is null or v_file_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 file_fingerprint is required.' using errcode = '22023';
  end if;
  if v_file_size is null or v_file_size <= 0 or v_file_size > 5242880 then
    raise exception 'File size must be between 1 byte and 5 MB.' using errcode = '22023';
  end if;
  if v_rows is null or jsonb_typeof(v_rows) <> 'array' or jsonb_array_length(v_rows) = 0 then
    raise exception 'No rows to import.' using errcode = '22023';
  end if;

  v_total := jsonb_array_length(v_rows);
  if v_total > 10000 then
    raise exception 'A bank import cannot exceed 10000 rows.' using errcode = '22023';
  end if;
  if v_source_total is null or v_source_total <> v_total or v_client_rejected <> 0 then
    raise exception 'BANK_IMPORT_PARTIAL_SOURCE_REJECTED' using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.bank_accounts as account
     where account.id = v_bank_account_id
       and account.company_id = v_company_id
       and account.deleted_at is null
       and account.is_active = true
  ) then
    raise exception 'Bank account not found, inactive, or not in your company.' using errcode = '42501';
  end if;

  v_payload_fingerprint := encode(
    extensions.digest(convert_to(v_rows::text, 'UTF8'), 'sha256'),
    'hex'
  );

  select existing.*
    into v_existing_import
    from public.bank_statement_imports as existing
   where existing.company_id = v_company_id
     and existing.file_fingerprint = v_file_fingerprint
     and existing.deleted_at is null
   limit 1;

  if found then
    if v_existing_import.bank_account_id <> v_bank_account_id then
      raise exception 'FILE_ALREADY_IMPORTED_TO_DIFFERENT_BANK_ACCOUNT' using errcode = '23505';
    end if;
    return to_jsonb(v_existing_import) || jsonb_build_object('is_duplicate_file', true);
  end if;

  select existing.*
    into v_existing_import
    from public.bank_statement_imports as existing
   where existing.company_id = v_company_id
     and existing.bank_account_id = v_bank_account_id
     and existing.normalized_payload_fingerprint = v_payload_fingerprint
     and existing.deleted_at is null
   limit 1;

  if found then
    return to_jsonb(v_existing_import) || jsonb_build_object('is_duplicate_file', true);
  end if;

  select coalesce(array_agg(line.fingerprint), '{}')
    into v_existing_fps
    from public.bank_statement_lines as line
   where line.company_id = v_company_id
     and line.bank_account_id = v_bank_account_id
     and line.deleted_at is null
     and line.fingerprint is not null;

  -- Validate every submitted source row before writing anything.
  for v_idx in 0..v_total - 1 loop
    v_row := v_rows->v_idx;
    if jsonb_typeof(v_row) <> 'object' then
      raise exception 'Invalid row object at row %', v_idx + 1 using errcode = '22023';
    end if;

    v_date_str := nullif(btrim(v_row->>'transaction_date'), '');
    v_amount_text := nullif(btrim(v_row->>'amount'), '');

    begin
      v_transaction_date := v_date_str::date;
    exception when invalid_datetime_format or datetime_field_overflow then
      raise exception 'Invalid transaction_date at row %: %', v_idx + 1, v_date_str using errcode = '22023';
    end;

    begin
      v_amount := round(v_amount_text::numeric, 3);
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Invalid amount at row %: %', v_idx + 1, v_amount_text using errcode = '22023';
    end;
    if v_amount is null or v_amount = 0 or v_amount::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception 'Invalid amount at row %: %', v_idx + 1, v_amount_text using errcode = '22023';
    end if;

    v_description := coalesce(nullif(btrim(v_row->>'description'), ''), 'حركة مستوردة');
    v_reference := nullif(btrim(v_row->>'reference'), '');
    v_currency := upper(coalesce(nullif(btrim(v_row->>'currency'), ''), 'OMR'));
    if v_currency !~ '^[A-Z]{3}$' then
      raise exception 'Invalid currency at row %: %', v_idx + 1, v_currency using errcode = '22023';
    end if;

    if nullif(btrim(v_row->>'balance'), '') is not null then
      begin
        v_balance := round((v_row->>'balance')::numeric, 3);
      exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Invalid balance at row %: %', v_idx + 1, v_row->>'balance' using errcode = '22023';
      end;
      if v_balance::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'Invalid balance at row %: %', v_idx + 1, v_row->>'balance' using errcode = '22023';
      end if;
    else
      v_balance := null;
    end if;

    v_fingerprint := public.bank_statement_line_fingerprint(
      v_company_id,
      v_bank_account_id,
      v_transaction_date,
      v_amount,
      v_currency,
      v_reference,
      v_description
    );

    if v_fingerprint = any(v_seen_fps) or v_fingerprint = any(v_existing_fps) then
      v_duplicate := v_duplicate + 1;
    else
      v_seen_fps := array_append(v_seen_fps, v_fingerprint);
      if exists (
        select 1
          from public.bank_statement_lines as candidate
         where candidate.company_id = v_company_id
           and candidate.bank_account_id = v_bank_account_id
           and candidate.transaction_date = v_transaction_date
           and candidate.amount = v_amount
           and candidate.deleted_at is null
      ) then
        v_possible := v_possible + 1;
      end if;
    end if;
  end loop;

  insert into public.bank_statement_imports (
    company_id,
    bank_account_id,
    statement_name,
    file_name,
    file_fingerprint,
    normalized_payload_fingerprint,
    file_size,
    total_rows,
    accepted_rows,
    rejected_rows,
    duplicate_rows,
    possible_duplicate_rows,
    status,
    error_summary,
    processed_at,
    created_by
  ) values (
    v_company_id,
    v_bank_account_id,
    coalesce(v_file_name, 'استيراد ' || to_char(now(), 'YYYY-MM-DD')),
    v_file_name,
    v_file_fingerprint,
    v_payload_fingerprint,
    v_file_size,
    v_total,
    0,
    0,
    v_duplicate,
    v_possible,
    'processing',
    '{}'::jsonb,
    null,
    auth.uid()
  )
  returning * into v_import;

  v_seen_fps := '{}';
  for v_idx in 0..v_total - 1 loop
    v_row := v_rows->v_idx;
    v_transaction_date := (v_row->>'transaction_date')::date;
    v_amount := round((v_row->>'amount')::numeric, 3);
    v_description := coalesce(nullif(btrim(v_row->>'description'), ''), 'حركة مستوردة');
    v_reference := nullif(btrim(v_row->>'reference'), '');
    v_currency := upper(coalesce(nullif(btrim(v_row->>'currency'), ''), 'OMR'));
    v_balance := case
      when nullif(btrim(v_row->>'balance'), '') is null then null
      else round((v_row->>'balance')::numeric, 3)
    end;
    v_fingerprint := public.bank_statement_line_fingerprint(
      v_company_id,
      v_bank_account_id,
      v_transaction_date,
      v_amount,
      v_currency,
      v_reference,
      v_description
    );

    if v_fingerprint = any(v_seen_fps) or v_fingerprint = any(v_existing_fps) then
      continue;
    end if;
    v_seen_fps := array_append(v_seen_fps, v_fingerprint);

    v_inserted_id := null;
    insert into public.bank_statement_lines (
      company_id,
      import_id,
      bank_account_id,
      transaction_date,
      description,
      reference,
      amount,
      balance,
      currency,
      external_reference,
      fingerprint,
      status
    ) values (
      v_company_id,
      v_import.id,
      v_bank_account_id,
      v_transaction_date,
      v_description,
      v_reference,
      v_amount,
      v_balance,
      v_currency,
      v_reference,
      v_fingerprint,
      'unmatched'
    )
    on conflict (company_id, fingerprint)
      where fingerprint is not null and deleted_at is null
    do nothing
    returning id into v_inserted_id;

    if v_inserted_id is null then
      v_duplicate := v_duplicate + 1;
    else
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  if v_inserted + v_duplicate <> v_total then
    raise exception 'BANK_IMPORT_COUNT_MISMATCH: total %, inserted %, duplicate %',
      v_total, v_inserted, v_duplicate;
  end if;

  update public.bank_statement_imports as batch
     set accepted_rows = v_inserted,
         rejected_rows = 0,
         duplicate_rows = v_duplicate,
         possible_duplicate_rows = least(v_possible, v_inserted),
         status = case when v_inserted = 0 then 'duplicate' else 'completed' end,
         error_summary = jsonb_build_object(
           'accepted_rows', v_inserted,
           'duplicate_rows', v_duplicate,
           'possible_duplicate_rows', least(v_possible, v_inserted)
         ),
         processed_at = now()
   where batch.id = v_import.id
   returning * into v_import;

  return to_jsonb(v_import) || jsonb_build_object('is_duplicate_file', false);
exception
  when unique_violation then
    select existing.*
      into v_existing_import
      from public.bank_statement_imports as existing
     where existing.company_id = v_company_id
       and existing.deleted_at is null
       and (
         existing.file_fingerprint = v_file_fingerprint
         or (
           existing.bank_account_id = v_bank_account_id
           and existing.normalized_payload_fingerprint = v_payload_fingerprint
         )
       )
     limit 1;

    if found then
      if v_existing_import.bank_account_id <> v_bank_account_id then
        raise exception 'FILE_ALREADY_IMPORTED_TO_DIFFERENT_BANK_ACCOUNT' using errcode = '23505';
      end if;
      return to_jsonb(v_existing_import) || jsonb_build_object('is_duplicate_file', true);
    end if;
    raise;
end;
$$;

alter function public.import_bank_statement_batch_atomic(jsonb) owner to postgres;
revoke all on function public.import_bank_statement_batch_atomic(jsonb) from public, anon;
grant execute on function public.import_bank_statement_batch_atomic(jsonb) to authenticated, service_role;

comment on function public.import_bank_statement_batch_atomic(jsonb) is
  'Fail-closed bank import: zero rejected source rows, server limits, actual persisted counts, company/account duplicate mismatch protection, and no accounting postings.';

commit;
