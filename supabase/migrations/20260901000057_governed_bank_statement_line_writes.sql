-- Governed browser write paths for bank statement lines.
--
-- ALLOW_GOVERNED_DATA_MIGRATION: the transactional bank_statement_lines insert
-- below is not ad-hoc data seeding; it is inside the governed
-- create_bank_statement_line_governed SECURITY DEFINER RPC body introduced by
-- this migration, with canonical ADMIN/MANAGER membership validation,
-- company scoping derived from the caller context (never the payload),
-- bank-account ownership validation, OMR 3-dp validation, and the canonical
-- duplicate fingerprint enforced by ux_bank_lines_company_fingerprint.
--
-- Defect (P1, data integrity / broken UI write path): the bank reconciliation
-- workspace creates a manual statement line and ignores a line through direct
-- table writes:
--
--   supabase.from('bank_statement_lines').insert(...)
--   supabase.from('bank_statement_lines').update({ status: 'ignored' })
--
-- Since migration 00001 revoked INSERT/UPDATE/DELETE on all public tables from
-- `authenticated` (browser writes to protected financial tables are forbidden),
-- those two user-reachable actions fail with "permission denied for table
-- bank_statement_lines" against the schema this repository builds. The
-- migration-baseline table grants they relied on were deliberately removed.
--
-- Fix at the correct enforcement layer (DATABASE_RULES.md: "Financial
-- mutations remain atomic, company-scoped, idempotent RPC operations"):
-- two governed SECURITY DEFINER RPCs following the exact authorization and
-- validation pattern of process_bank_reconciliation_match_atomic /
-- import_bank_statement_batch_atomic:
--
--   * create_bank_statement_line_governed(payload jsonb)
--       - authenticated app user + ADMIN or MANAGER membership required;
--       - company derived from the validated caller context, never the payload;
--       - the bank account must belong to that company;
--       - amount non-zero, OMR 3-dp; the line is created 'unmatched';
--       - the canonical duplicate fingerprint (company|account|date|amount|
--         currency|reference|lower(description)) is computed server-side so
--         the existing ux_bank_lines_company_fingerprint unique index keeps
--         protecting manual lines exactly like imported ones.
--
--   * ignore_bank_statement_line_governed(p_statement_line_id uuid)
--       - same authority gate;
--       - company-scoped row lock on the statement line;
--       - only an UNMATCHED line may be ignored: a MATCHED line carries a
--         reconciliation match record and must be handled through the
--         governed match path, so ignoring can no longer orphan a match or
--         hide an economically matched movement.
--
-- No table, constraint, RLS policy or existing RPC is modified. The browser
-- direct-write code path is replaced by these RPCs in the frontend service.

begin;

create or replace function public.create_bank_statement_line_governed(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_bank_account_id uuid;
  v_transaction_date date;
  v_description text;
  v_reference text;
  v_amount numeric;
  v_currency text;
  v_fingerprint text;
  v_line public.bank_statement_lines%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Bank statement line creation requires ADMIN or MANAGER.' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if payload ? 'company_id' then
    raise exception 'BANK_LINE_COMPANY_IS_SERVER_OWNED: company is derived from the caller context.' using errcode = '22023';
  end if;
  if payload ? 'status' then
    raise exception 'BANK_LINE_STATUS_IS_SERVER_OWNED: manual lines are created unmatched.' using errcode = '22023';
  end if;
  if payload ? 'fingerprint' then
    raise exception 'BANK_LINE_FINGERPRINT_IS_SERVER_OWNED.' using errcode = '22023';
  end if;

  v_bank_account_id := nullif(payload->>'bank_account_id', '')::uuid;
  v_transaction_date := nullif(payload->>'transaction_date', '')::date;
  v_amount := nullif(payload->>'amount', '')::numeric;
  v_description := btrim(coalesce(payload->>'description', ''));
  v_reference := lower(btrim(coalesce(payload->>'reference', '')));
  v_currency := upper(btrim(coalesce(payload->>'currency', 'OMR')));

  if v_bank_account_id is null then
    raise exception 'bank_account_id is required.' using errcode = '22023';
  end if;
  if v_transaction_date is null then
    raise exception 'transaction_date is required.' using errcode = '22023';
  end if;
  if v_amount is null or v_amount = 0 then
    raise exception 'amount must be non-zero.' using errcode = '22023';
  end if;
  if v_amount <> round(v_amount, 3) then
    raise exception 'amount must respect OMR 3-decimal precision.' using errcode = '22023';
  end if;
  if v_description = '' then
    v_description := 'حركة بنكية';
  end if;
  if v_currency <> 'OMR' then
    raise exception 'Only OMR bank statement lines are supported.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.bank_accounts ba
    where ba.id = v_bank_account_id
      and ba.company_id = v_company_id
      and ba.deleted_at is null
  ) then
    raise exception 'Bank account was not found in the active company.' using errcode = 'P0002';
  end if;

  v_fingerprint := md5(
    coalesce(v_company_id::text, '') || '|' ||
    coalesce(v_bank_account_id::text, '') || '|' ||
    coalesce(v_transaction_date::text, '') || '|' ||
    coalesce(to_char(v_amount, 'FM9999999999990.000'), '') || '|' ||
    coalesce(v_currency, 'OMR') || '|' ||
    coalesce(v_reference, '') || '|' ||
    lower(coalesce(v_description, ''))
  );

  begin
    insert into public.bank_statement_lines (
      company_id, bank_account_id, transaction_date, description,
      reference, amount, currency, fingerprint, status
    ) values (
      v_company_id, v_bank_account_id, v_transaction_date, v_description,
      nullif(v_reference, ''), v_amount, v_currency, v_fingerprint, 'unmatched'
    )
    returning * into v_line;
  exception
    when unique_violation then
      raise exception 'BANK_LINE_DUPLICATE_FINGERPRINT: an identical statement line already exists for this company.' using errcode = '23505';
  end;

  return to_jsonb(v_line);
end;
$function$;

revoke all on function public.create_bank_statement_line_governed(jsonb) from public, anon;
grant execute on function public.create_bank_statement_line_governed(jsonb) to authenticated, service_role;

comment on function public.create_bank_statement_line_governed(jsonb) is
  'Governed manual bank statement line creation. ADMIN/MANAGER, company-scoped, duplicate-fingerprint protected, always created unmatched.';

create or replace function public.ignore_bank_statement_line_governed(p_statement_line_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_company_id uuid;
  v_line public.bank_statement_lines%rowtype;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Ignoring a bank statement line requires ADMIN or MANAGER.' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if p_statement_line_id is null then
    raise exception 'statement_line_id is required.' using errcode = '22023';
  end if;

  select * into v_line
  from public.bank_statement_lines
  where id = p_statement_line_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Bank statement line was not found.' using errcode = 'P0002';
  end if;

  if lower(coalesce(v_line.status, '')) = 'matched' then
    raise exception 'BANK_LINE_MATCHED_CANNOT_BE_IGNORED: a matched line carries a reconciliation match and must be handled through the governed match path.' using errcode = '23514';
  end if;
  if lower(coalesce(v_line.status, '')) = 'ignored' then
    raise exception 'Bank statement line is already ignored.' using errcode = '23514';
  end if;

  update public.bank_statement_lines
  set status = 'ignored',
      updated_at = now()
  where id = v_line.id
    and company_id = v_company_id
  returning * into v_line;

  return to_jsonb(v_line);
end;
$function$;

revoke all on function public.ignore_bank_statement_line_governed(uuid) from public, anon;
grant execute on function public.ignore_bank_statement_line_governed(uuid) to authenticated, service_role;

comment on function public.ignore_bank_statement_line_governed(uuid) is
  'Governed bank statement line ignore. ADMIN/MANAGER, company-scoped, only from unmatched status so an existing reconciliation match can never be orphaned.';

notify pgrst, 'reload schema';
commit;
