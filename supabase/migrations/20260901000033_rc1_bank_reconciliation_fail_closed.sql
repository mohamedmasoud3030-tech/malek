-- MALEK RC1 Group 2 — Bank & Reconciliation hardening.
-- Forward-only: authoritative bank CSV import is fail-closed; reconciliation
-- supports deterministic receipt void and deposit-refund reversal matches.
-- ALLOW_GOVERNED_DATA_MIGRATION: the transactional bank_statement_imports
-- and bank_statement_lines inserts below are not ad-hoc data seeding; they are
-- inside the governed import_bank_statement_batch_atomic RPC body replaced by
-- this migration, with canonical role/company validation, duplicate prevention,
-- authoritative preview validation, and transaction rollback semantics.

begin;

-- Keep type coverage aligned before replacing the RPC/trigger.
alter table public.bank_reconciliation_matches
  drop constraint if exists bank_reconciliation_matches_type_chk;

alter table public.bank_reconciliation_matches
  add constraint bank_reconciliation_matches_type_chk
  check (matched_entity_type in (
    'payment', 'receipt', 'expense', 'manual_adjustment',
    'owner_payout', 'deposit_receipt', 'deposit_refund',
    'receipt_void', 'deposit_refund_reversal',
    'commission_payment', 'owner_expense'
  ));

CREATE OR REPLACE FUNCTION "public"."import_bank_statement_batch_atomic"("payload" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
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
  v_amount_supplied boolean;
  v_debit_supplied boolean;
  v_credit_supplied boolean;
  v_supplied_amount_count integer;
  v_debit numeric;
  v_credit numeric;
  v_canonical_rows jsonb := '[]'::jsonb;
  v_payload_digest text;
  v_preview jsonb;
  v_inserted_count integer := 0;
begin
  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Only managers can import bank statements.' using errcode = '42501';
  end if;

  -- Authoritative preview first: validates, never writes, detects content reuse.
  v_preview := public.preview_bank_statement_batch_atomic(payload);
  if coalesce((v_preview->>'is_duplicate_file')::boolean, false) then
    return v_preview || jsonb_build_object('write_attempted', false);
  end if;

  v_company_id := public.current_company_id();
  v_bank_account_id := nullif(payload->>'bank_account_id','')::uuid;
  v_file_name := nullif(payload->>'file_name','');
  v_file_fingerprint := nullif(payload->>'file_fingerprint','');
  v_file_size := nullif(payload->>'file_size','')::integer;
  v_rows := payload->'rows';
  v_total := jsonb_array_length(v_rows);
  v_accepted := coalesce((v_preview->>'accepted_rows')::integer, 0);
  v_duplicate := coalesce((v_preview->>'duplicate_rows')::integer, 0);
  v_possible := coalesce((v_preview->>'possible_duplicate_rows')::integer, 0);
  v_payload_digest := v_preview->>'payload_digest';

  -- Serialize authoritative imports per company/bank account. Preview is
  -- intentionally no-write; this transaction lock closes the race between
  -- preview duplicate detection and line insertion so an import cannot be
  -- committed with missing/partial lines.
  perform pg_advisory_xact_lock(
    hashtextextended('bank_statement_import:' || v_company_id::text || ':' || v_bank_account_id::text, 0)
  );

  select coalesce(array_agg(fingerprint), '{}') into v_existing_fps
  from public.bank_statement_lines
  where company_id = v_company_id
    and bank_account_id = v_bank_account_id
    and deleted_at is null
    and fingerprint is not null;

  -- Rebuild canonical rows with the same first-pass rules as preview.
  for v_idx in 0..v_total-1 loop
    v_row := v_rows->v_idx;
    v_date_str := v_row->>'transaction_date';
    v_amount_text := nullif(trim(both ' ' from coalesce(v_row->>'amount','')), '');
    v_debit_text := nullif(trim(both ' ' from coalesce(v_row->>'debit','')), '');
    v_credit_text := nullif(trim(both ' ' from coalesce(v_row->>'credit','')), '');
    v_amount_supplied := v_amount_text is not null;
    v_debit_supplied := v_debit_text is not null;
    v_credit_supplied := v_credit_text is not null;

    v_transaction_date := v_date_str::date;
    if v_amount_supplied then
      v_amount := v_amount_text::numeric;
    elsif v_debit_supplied then
      v_amount := -abs(v_debit_text::numeric);
    else
      v_amount := abs(v_credit_text::numeric);
    end if;

    v_description := trim(both ' ' from coalesce(v_row->>'description',''));
    if v_description = '' then v_description := 'حركة مستوردة'; end if;
    v_reference := lower(trim(both ' ' from coalesce(v_row->>'reference','')));
    v_currency := upper(trim(both ' ' from coalesce(v_row->>'currency','OMR')));
    v_balance := null;
    if nullif(v_row->>'balance','') is not null then
      v_balance := (v_row->>'balance')::numeric;
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

    v_canonical_rows := v_canonical_rows || jsonb_build_array(jsonb_build_object(
      'transaction_date', v_transaction_date::text,
      'amount', to_char(v_amount, 'FM9999999999990.000'),
      'description', v_description,
      'reference', v_reference,
      'balance', case when v_balance is null then null else to_char(v_balance, 'FM9999999999990.000') end,
      'currency', v_currency,
      'fingerprint', v_fingerprint
    ));
  end loop;

  begin
    insert into public.bank_statement_imports (
      company_id, bank_account_id, statement_name, file_name, file_fingerprint,
      file_size, total_rows, accepted_rows, rejected_rows, duplicate_rows,
      possible_duplicate_rows, status, error_summary, processed_at, created_by,
      payload_digest
    ) values (
      v_company_id, v_bank_account_id,
      coalesce(v_file_name, 'استيراد ' || to_char(now(),'YYYY-MM-DD')),
      v_file_name, v_file_fingerprint, v_file_size, v_total, v_accepted, 0,
      v_duplicate, v_possible,
      case when v_accepted = 0 and v_duplicate > 0 then 'duplicate' else 'completed' end,
      jsonb_build_object('duplicate_rows', v_duplicate, 'possible_duplicate_rows', v_possible, 'accepted_rows', v_accepted),
      now(), auth.uid(), v_payload_digest
    ) returning * into v_import;
  exception when unique_violation then
    select * into v_existing_import
    from public.bank_statement_imports
    where company_id = v_company_id and file_fingerprint = v_file_fingerprint and deleted_at is null limit 1;
    if found then
      if v_existing_import.payload_digest is not null
         and v_existing_import.payload_digest <> v_payload_digest then
        raise exception 'file_fingerprint was already used with different content.' using errcode='22023';
      end if;
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

  v_seen_fps := '{}';
  if v_accepted > 0 then
    for v_idx in 0..jsonb_array_length(v_canonical_rows)-1 loop
      v_row := v_canonical_rows->v_idx;
      v_transaction_date := (v_row->>'transaction_date')::date;
      v_amount := (v_row->>'amount')::numeric;
      v_description := v_row->>'description';
      v_reference := v_row->>'reference';
      v_balance := nullif(v_row->>'balance','')::numeric;
      v_currency := v_row->>'currency';
      v_fingerprint := v_row->>'fingerprint';

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
      returning id into v_dummy;
      v_inserted_fps := array_append(v_inserted_fps, v_fingerprint);
      v_inserted_count := v_inserted_count + 1;
    end loop;
  end if;

  if v_inserted_count <> v_accepted then
    raise exception 'BANK_IMPORT_ATOMIC_INSERT_COUNT_MISMATCH: expected % accepted rows but inserted % lines.', v_accepted, v_inserted_count
      using errcode = '23514';
  end if;

  select * into v_import from public.bank_statement_imports where id = v_import.id;

  return jsonb_build_object(
    'id', v_import.id, 'reference', v_import.reference,
    'bank_account_id', v_import.bank_account_id,
    'file_name', v_import.file_name,
    'file_fingerprint', v_import.file_fingerprint,
    'payload_digest', v_import.payload_digest,
    'total_rows', v_import.total_rows,
    'accepted_rows', v_import.accepted_rows,
    'rejected_rows', v_import.rejected_rows,
    'duplicate_rows', v_import.duplicate_rows,
    'possible_duplicate_rows', v_import.possible_duplicate_rows,
    'status', v_import.status, 'is_duplicate_file', false
  );
end;
$$;



ALTER FUNCTION "public"."import_bank_statement_batch_atomic"("payload" "jsonb") OWNER TO "postgres";
revoke all on function public.import_bank_statement_batch_atomic(jsonb) from public, anon;
grant execute on function public.import_bank_statement_batch_atomic(jsonb) to authenticated, service_role;
COMMENT ON FUNCTION "public"."import_bank_statement_batch_atomic"("payload" "jsonb") IS 'RC1 Group 2: authoritative fail-closed bank CSV import. Preview validation + import header + accepted lines commit atomically; any line failure rolls back the import.';

create or replace function public.guard_bank_reconciliation_match_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_receipt_status text;
  v_batch_status text;
  v_batch_source_type text;
  v_batch_company_id uuid;
  v_cash_movement numeric(18,3);
  v_entity_amount numeric(18,3);
  v_entity_status text;
begin
  if new.matched_entity_type = 'receipt' then
    select upper(coalesce(r.status, '')), r.amount
      into v_receipt_status, v_entity_amount
    from public.receipts r
    where r.id::text = new.matched_entity_id
      and r.company_id = new.company_id
      and r.deleted_at is null;

    if not found then
      raise exception 'Matched receipt was not found in the active company.' using errcode = 'P0002';
    end if;
    if v_receipt_status <> 'POSTED' then
      raise exception 'Receipt must be POSTED to be reconciled.' using errcode = '23514';
    end if;
    if new.matched_amount <= 0 or abs(v_entity_amount) <> abs(new.matched_amount) then
      raise exception 'Receipt match must be a positive exact bank movement.' using errcode = '23514';
    end if;
  end if;

  if new.matched_entity_type = 'receipt_void' then
    select upper(coalesce(r.status, '')), r.amount
      into v_receipt_status, v_entity_amount
    from public.receipts r
    where r.id::text = new.matched_entity_id
      and r.company_id = new.company_id
      and r.deleted_at is null;

    if not found then
      raise exception 'Matched receipt void was not found in the active company.' using errcode = 'P0002';
    end if;
    if v_receipt_status not in ('VOID', 'VOIDED', 'REVERSED') then
      raise exception 'Receipt void match requires a voided/reversed receipt.' using errcode = '23514';
    end if;
    if new.matched_amount >= 0 or abs(v_entity_amount) <> abs(new.matched_amount) then
      raise exception 'Receipt void match must be a negative exact bank movement.' using errcode = '23514';
    end if;
  end if;

  if new.matched_entity_type = 'deposit_refund_reversal' then
    select r.amount, upper(coalesce(r.status, ''))
      into v_entity_amount, v_entity_status
    from public.deposit_refund_events r
    where r.id::text = new.matched_entity_id
      and r.company_id = new.company_id
      and r.reversal_journal_batch_id is not null;

    if not found then
      raise exception 'Matched deposit refund reversal was not found.' using errcode = 'P0002';
    end if;
    if v_entity_status <> 'REVERSED' then
      raise exception 'Deposit refund reversal must be REVERSED to be reconciled.' using errcode = '23514';
    end if;
    if new.matched_amount <= 0 or abs(v_entity_amount) <> abs(new.matched_amount) then
      raise exception 'Deposit refund reversal match must be a positive exact bank movement.' using errcode = '23514';
    end if;
  end if;

  if new.matched_entity_type = 'manual_adjustment' then
    select b.company_id, upper(coalesce(b.status, '')), lower(coalesce(b.source_type, ''))
      into v_batch_company_id, v_batch_status, v_batch_source_type
    from public.journal_batches b
    where b.id::text = new.matched_entity_id
      and b.company_id = new.company_id;

    if not found then
      raise exception 'Manual adjustment must reference a real journal batch in the active company.' using errcode = 'P0002';
    end if;
    if v_batch_status <> 'POSTED' or v_batch_source_type <> 'manual_adjustment' then
      raise exception 'Manual adjustment must reference a POSTED manual_adjustment journal batch.' using errcode = '23514';
    end if;

    select round(coalesce(sum(round(jl.debit, 3) - round(jl.credit, 3)), 0), 3)
      into v_cash_movement
    from public.journal_lines jl
    join public.accounts a
      on a.id = jl.account_id
     and a.company_id = jl.company_id
    where jl.batch_id = new.matched_entity_id::uuid
      and jl.company_id = new.company_id
      and a.no in ('1111', '1120');

    if v_cash_movement = 0 then
      raise exception 'Manual adjustment has no governed 1111/1120 cash-bank movement.' using errcode = '23514';
    end if;
    if round(v_cash_movement, 3) <> round(new.matched_amount, 3) then
      raise exception 'Manual adjustment cash-bank movement does not equal the bank statement amount.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

alter function public.guard_bank_reconciliation_match_integrity() owner to postgres;
revoke all on function public.guard_bank_reconciliation_match_integrity() from public, anon, authenticated;
grant execute on function public.guard_bank_reconciliation_match_integrity() to service_role;

drop trigger if exists trg_bank_reconciliation_match_integrity on public.bank_reconciliation_matches;
create trigger trg_bank_reconciliation_match_integrity
before insert or update of matched_entity_type, matched_entity_id, matched_amount, company_id
on public.bank_reconciliation_matches
for each row
execute function public.guard_bank_reconciliation_match_integrity();

create or replace function public.process_bank_reconciliation_match_atomic(payload jsonb)
returns public.bank_reconciliation_matches
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_company_id uuid;
  v_statement_line_id uuid := nullif(payload->>'statement_line_id', '')::uuid;
  v_matched_entity_type text := nullif(payload->>'matched_entity_type', '');
  v_matched_entity_id text := nullif(payload->>'matched_entity_id', '');
  v_matched_amount numeric := nullif(payload->>'matched_amount', '')::numeric;
  v_notes text := nullif(payload->>'notes', '');
  v_line public.bank_statement_lines%rowtype;
  v_match public.bank_reconciliation_matches%rowtype;
  v_entity_amount numeric;
  v_entity_status text;
  v_entity_company_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;

  if not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Bank reconciliation matching requires ADMIN or MANAGER.' using errcode = '42501';
  end if;

  v_company_id := public.require_company_id();

  if v_statement_line_id is null then
    raise exception 'statement_line_id is required.' using errcode = '22023';
  end if;
  if v_matched_entity_type not in (
    'payment', 'receipt', 'expense', 'manual_adjustment',
    'owner_payout', 'deposit_receipt', 'deposit_refund', 'receipt_void',
    'deposit_refund_reversal', 'commission_payment', 'owner_expense'
  ) then
    raise exception 'Invalid matched_entity_type.' using errcode = '22023';
  end if;
  if v_matched_entity_id is null then
    raise exception 'matched_entity_id is required.' using errcode = '22023';
  end if;
  if v_matched_amount is null or v_matched_amount = 0 then
    raise exception 'matched_amount must be non-zero.' using errcode = '22023';
  end if;

  select * into v_line
  from public.bank_statement_lines
  where id = v_statement_line_id
    and company_id = v_company_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Bank statement line was not found.' using errcode = 'P0002';
  end if;
  if lower(coalesce(v_line.status, '')) <> 'unmatched' then
    raise exception 'Bank statement line is already processed.' using errcode = '23514';
  end if;

  if v_matched_amount <> v_line.amount then
    raise exception 'matched_amount must equal the bank statement line amount.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.bank_reconciliation_matches m
    where m.statement_line_id = v_statement_line_id
      and m.company_id = v_company_id
  ) then
    raise exception 'Bank statement line already has a match.' using errcode = '23514';
  end if;

  if v_matched_entity_type = 'payment' then
    select p.amount, p.company_id into v_entity_amount, v_entity_company_id
    from public.payments p
    where p.id::text = v_matched_entity_id
      and p.company_id = v_company_id
      and p.deleted_at is null;
    if not found then
      raise exception 'Matched payment was not found in the active company.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company payment match rejected.' using errcode = '42501';
    end if;
    if v_line.amount <= 0 then
      raise exception 'Payment matches require positive bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Payment amount does not match bank line amount.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.bank_reconciliation_matches m
      where m.matched_entity_type = 'payment'
        and m.matched_entity_id = v_matched_entity_id
        and m.company_id = v_company_id
    ) then
      raise exception 'Payment already matched to another bank line.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'receipt' then
    select r.amount, r.company_id, coalesce(r.status, 'POSTED') into v_entity_amount, v_entity_company_id, v_entity_status
    from public.receipts r
    where r.id::text = v_matched_entity_id
      and r.company_id = v_company_id
      and r.deleted_at is null;
    if not found then
      raise exception 'Matched receipt was not found in the active company.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company receipt match rejected.' using errcode = '42501';
    end if;
    if upper(v_entity_status) <> 'POSTED' then
      raise exception 'Receipt must be POSTED to be reconciled.' using errcode = '23514';
    end if;
    if v_line.amount <= 0 then
      raise exception 'Receipt matches require positive bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Receipt amount does not match bank line amount.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.bank_reconciliation_matches m
      where m.matched_entity_type = 'receipt'
        and m.matched_entity_id = v_matched_entity_id
        and m.company_id = v_company_id
    ) then
      raise exception 'Receipt already matched.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'expense' then
    select e.amount, e.company_id, coalesce(e.charged_to, 'COMPANY') into v_entity_amount, v_entity_company_id, v_entity_status
    from public.expenses e
    where e.id::text = v_matched_entity_id
      and e.company_id = v_company_id
      and e.deleted_at is null;
    if not found then
      raise exception 'Matched expense was not found in the active company.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company expense match rejected.' using errcode = '42501';
    end if;
    if upper(v_entity_status) <> 'COMPANY' then
      raise exception 'Expense candidate must have charged_to=COMPANY for company expense type.' using errcode = '23514';
    end if;
    if v_line.amount >= 0 then
      raise exception 'Company expense matches require negative bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Expense amount does not match bank line amount.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.bank_reconciliation_matches m
      where m.matched_entity_type = 'expense'
        and m.matched_entity_id = v_matched_entity_id
        and m.company_id = v_company_id
    ) then
      raise exception 'Expense already matched.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'owner_expense' then
    select e.amount, e.company_id, coalesce(e.charged_to, '') into v_entity_amount, v_entity_company_id, v_entity_status
    from public.expenses e
    where e.id::text = v_matched_entity_id
      and e.company_id = v_company_id
      and e.deleted_at is null;
    if not found then
      raise exception 'Matched owner expense was not found.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company owner expense match rejected.' using errcode = '42501';
    end if;
    if upper(v_entity_status) <> 'OWNER' then
      raise exception 'Owner expense candidate must have charged_to=OWNER.' using errcode = '23514';
    end if;
    if v_line.amount >= 0 then
      raise exception 'Owner expense matches require negative bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Owner expense amount does not match bank line amount.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'owner_payout' then
    select s.net_payable, s.company_id, s.status into v_entity_amount, v_entity_company_id, v_entity_status
    from public.owner_settlements s
    where s.id::text = v_matched_entity_id
      and s.company_id = v_company_id;
    if not found then
      raise exception 'Matched owner payout was not found.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company owner payout match rejected.' using errcode = '42501';
    end if;
    if upper(v_entity_status) <> 'PAID' then
      raise exception 'Owner payout must be PAID to be reconciled.' using errcode = '23514';
    end if;
    if v_line.amount >= 0 then
      raise exception 'Owner payout matches require negative bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Owner payout amount does not match bank line amount.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'deposit_receipt' then
    select d.deposit_amount, d.company_id into v_entity_amount, v_entity_company_id
    from public.tenant_deposits d
    where d.id::text = v_matched_entity_id
      and d.company_id = v_company_id
      and d.deleted_at is null;
    if not found then
      raise exception 'Matched deposit receipt was not found.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company deposit receipt match rejected.' using errcode = '42501';
    end if;
    if v_line.amount <= 0 then
      raise exception 'Deposit receipt matches require positive bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Deposit receipt amount does not match bank line amount.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'deposit_refund' then
    select r.amount, r.company_id, r.status into v_entity_amount, v_entity_company_id, v_entity_status
    from public.deposit_refund_events r
    where r.id::text = v_matched_entity_id
      and r.company_id = v_company_id;
    if not found then
      raise exception 'Matched deposit refund was not found.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company deposit refund match rejected.' using errcode = '42501';
    end if;
    if upper(v_entity_status) <> 'POSTED' then
      raise exception 'Deposit refund must be POSTED to be reconciled.' using errcode = '23514';
    end if;
    if v_line.amount >= 0 then
      raise exception 'Deposit refund matches require negative bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Deposit refund amount does not match bank line amount.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'receipt_void' then
    select r.amount, r.company_id, coalesce(r.status, '') into v_entity_amount, v_entity_company_id, v_entity_status
    from public.receipts r
    where r.id::text = v_matched_entity_id
      and r.company_id = v_company_id
      and r.deleted_at is null;
    if not found then
      raise exception 'Matched receipt void was not found in the active company.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company receipt void match rejected.' using errcode = '42501';
    end if;
    if upper(v_entity_status) not in ('VOID', 'VOIDED', 'REVERSED') then
      raise exception 'Receipt void match requires a voided/reversed receipt.' using errcode = '23514';
    end if;
    if v_line.amount >= 0 then
      raise exception 'Receipt void matches require negative bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Receipt void amount does not match bank line amount.' using errcode = '23514';
    end if;
    if not exists (
      select 1
      from public.journal_batches original_batch
      join public.journal_batches reversal_batch
        on reversal_batch.company_id = original_batch.company_id
       and reversal_batch.reversal_of_batch_id = original_batch.id
       and upper(coalesce(reversal_batch.status, '')) = 'POSTED'
      where original_batch.company_id = v_company_id
        and original_batch.source_type = 'receipt'
        and original_batch.source_id = v_matched_entity_id
    ) and not exists (
      select 1 from public.journal_entries je
      where je.company_id = v_company_id
        and je.source_id = v_matched_entity_id
        and je.entity_type = 'receipt_void'
        and je.deleted_at is null
    ) then
      raise exception 'Receipt void requires a persisted journal reversal authority.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'deposit_refund_reversal' then
    select r.amount, r.company_id, r.status into v_entity_amount, v_entity_company_id, v_entity_status
    from public.deposit_refund_events r
    where r.id::text = v_matched_entity_id
      and r.company_id = v_company_id
      and r.reversal_journal_batch_id is not null;
    if not found then
      raise exception 'Matched deposit refund reversal was not found.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company deposit refund reversal match rejected.' using errcode = '42501';
    end if;
    if upper(v_entity_status) <> 'REVERSED' then
      raise exception 'Deposit refund reversal must be REVERSED to be reconciled.' using errcode = '23514';
    end if;
    if v_line.amount <= 0 then
      raise exception 'Deposit refund reversal matches require positive bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Deposit refund reversal amount does not match bank line amount.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'commission_payment' then
    select c.amount, c.company_id, c.status into v_entity_amount, v_entity_company_id, v_entity_status
    from public.commissions c
    where c.id::text = v_matched_entity_id
      and c.company_id = v_company_id;
    if not found then
      raise exception 'Matched commission payment was not found.' using errcode = 'P0002';
    end if;
    if v_entity_company_id <> v_company_id then
      raise exception 'Cross-company commission payment match rejected.' using errcode = '42501';
    end if;
    if upper(v_entity_status) <> 'PAID' then
      raise exception 'Commission payment must be PAID to be reconciled.' using errcode = '23514';
    end if;
    if v_line.amount >= 0 then
      raise exception 'Commission payment matches require negative bank amount.' using errcode = '23514';
    end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then
      raise exception 'Commission payment amount does not match bank line amount.' using errcode = '23514';
    end if;

  elsif v_matched_entity_type = 'manual_adjustment' then
    if not exists (
      select 1 from public.journal_batches b
      where b.id::text = v_matched_entity_id
        and b.company_id = v_company_id
        and b.source_type = 'manual_adjustment'
        and b.status = 'POSTED'
    ) then
      raise exception 'Manual adjustment must reference real persisted POSTED journal_batches with source_type manual_adjustment.' using errcode = 'P0002';
    end if;
  end if;

  insert into public.bank_reconciliation_matches (
    statement_line_id,
    matched_entity_type,
    matched_entity_id,
    matched_amount,
    notes,
    matched_by,
    company_id
  ) values (
    v_statement_line_id,
    v_matched_entity_type,
    v_matched_entity_id,
    v_matched_amount,
    v_notes,
    auth.uid(),
    v_company_id
  )
  returning * into v_match;

  update public.bank_statement_lines
  set status = 'matched', updated_at = now()
  where id = v_statement_line_id
    and company_id = v_company_id;

  -- audit_log has no top-level company_id column in the canonical schema.
  -- The company context remains present in both serialized values because
  -- v_line and v_match are company-scoped rowtypes.
  insert into public.audit_log (
    id, user_id, action, entity, entity_id, note, "table",
    old_value, new_value, action_timestamp, created_at, updated_at
  ) values (
    gen_random_uuid()::text,
    auth.uid(),
    'PROCESS_BANK_RECONCILIATION_MATCH_ATOMIC',
    'bank_reconciliation_match',
    v_match.id::text,
    'Bank statement line matched atomically through RPC with full validation (FOM-013).',
    'bank_reconciliation_matches',
    to_jsonb(v_line),
    jsonb_build_object('match', to_jsonb(v_match), 'statement_line_status', 'matched'),
    now(), now(), now()
  );

  return v_match;
end;
$$;


alter function public.process_bank_reconciliation_match_atomic(jsonb) owner to postgres;
comment on function public.process_bank_reconciliation_match_atomic(jsonb) is
  'RC1 Group 2: validates reconciliation entity/company/direction/amount/status, including receipt void and deposit refund reversal authority; prevents duplicate economic matches; manual adjustments must reference posted governed journals.';

comment on constraint bank_reconciliation_matches_type_chk on public.bank_reconciliation_matches is
  'RC1 Group 2: includes deterministic receipt_void and deposit_refund_reversal match types; manual adjustments remain posted-journal only.';

-- Preserve the existing DB guardian boundary while this migration replaces
-- SECURITY DEFINER functions: server-only accrual execution must not become
-- browser-executable, and the browser cash-flow report must not contain an
-- owner-identity current_user guard.
revoke all on function public.gl_run_fixed_monthly_accruals(uuid, date, date, uuid, uuid) from public, anon, authenticated;
grant execute on function public.gl_run_fixed_monthly_accruals(uuid, date, date, uuid, uuid) to service_role;

do $rc1_remove_wp05_current_user_guard$
declare
  v_sql text;
  v_old text := $old$  -- Company isolation enforced by require_company_id and RLS, but double-check
  if public.current_company_id() is not null and public.current_company_id() <> v_company_id then
    if current_user not in ('service_role','postgres','supabase_admin') then
      raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
    end if;
  end if;$old$;
  v_new text := $new$  -- Company isolation is enforced by require_company_id/current_company_id;
  -- do not use current_user inside SECURITY DEFINER as caller identity.
  if public.current_company_id() is null or public.current_company_id() <> v_company_id then
    raise exception 'WP05_COMPANY_ISOLATION_VIOLATION' using errcode='42501';
  end if;$new$;
begin
  select pg_get_functiondef('public.wp05_rpt_cash_flow_gl(date,date)'::regprocedure) into v_sql;
  if position(v_old in v_sql) = 0 then
    raise exception 'RC1_WP05_CASH_FLOW_GUARD_ANCHOR_NOT_FOUND';
  end if;
  execute replace(v_sql, v_old, v_new);
end;
$rc1_remove_wp05_current_user_guard$;

alter function public.wp05_rpt_cash_flow_gl(date, date) owner to postgres;
revoke all on function public.wp05_rpt_cash_flow_gl(date, date) from public, anon;
grant execute on function public.wp05_rpt_cash_flow_gl(date, date) to authenticated, service_role;

commit;
