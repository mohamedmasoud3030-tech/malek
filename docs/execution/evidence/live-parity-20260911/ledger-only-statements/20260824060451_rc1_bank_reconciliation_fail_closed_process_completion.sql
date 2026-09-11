begin;

create or replace function public.process_bank_reconciliation_match_atomic(payload jsonb)
returns public.bank_reconciliation_matches
language plpgsql security definer set search_path to 'public','pg_temp'
as $$
declare
  v_company_id uuid;
  v_statement_line_id uuid := nullif(payload->>'statement_line_id','')::uuid;
  v_matched_entity_type text := nullif(payload->>'matched_entity_type','');
  v_matched_entity_id text := nullif(payload->>'matched_entity_id','');
  v_matched_amount numeric := nullif(payload->>'matched_amount','')::numeric;
  v_notes text := nullif(payload->>'notes','');
  v_line public.bank_statement_lines%rowtype;
  v_match public.bank_reconciliation_matches%rowtype;
  v_entity_amount numeric;
  v_entity_status text;
  v_entity_company_id uuid;
begin
  if auth.uid() is null or not coalesce(public.is_app_user(),false) then raise exception 'Authenticated app user is required.' using errcode='42501'; end if;
  if not coalesce(public.is_admin_or_manager(),false) then raise exception 'Bank reconciliation matching requires ADMIN or MANAGER.' using errcode='42501'; end if;
  v_company_id := public.require_company_id();
  if v_statement_line_id is null then raise exception 'statement_line_id is required.' using errcode='22023'; end if;
  if v_matched_entity_type not in ('payment','receipt','expense','manual_adjustment','owner_payout','deposit_receipt','deposit_refund','receipt_void','deposit_refund_reversal','commission_payment','owner_expense') then raise exception 'Invalid matched_entity_type.' using errcode='22023'; end if;
  if v_matched_entity_id is null then raise exception 'matched_entity_id is required.' using errcode='22023'; end if;
  if v_matched_amount is null or v_matched_amount=0 then raise exception 'matched_amount must be non-zero.' using errcode='22023'; end if;
  select * into v_line from public.bank_statement_lines where id=v_statement_line_id and company_id=v_company_id and deleted_at is null for update;
  if not found then raise exception 'Bank statement line was not found.' using errcode='P0002'; end if;
  if lower(coalesce(v_line.status,'')) <> 'unmatched' then raise exception 'Bank statement line is already processed.' using errcode='23514'; end if;
  if v_matched_amount <> v_line.amount then raise exception 'matched_amount must equal the bank statement line amount.' using errcode='23514'; end if;
  if exists(select 1 from public.bank_reconciliation_matches m where m.statement_line_id=v_statement_line_id and m.company_id=v_company_id) then raise exception 'Bank statement line already has a match.' using errcode='23514'; end if;

  if v_matched_entity_type='payment' then
    select p.amount,p.company_id into v_entity_amount,v_entity_company_id from public.payments p where p.id::text=v_matched_entity_id and p.company_id=v_company_id and p.deleted_at is null;
    if not found then raise exception 'Matched payment was not found in the active company.' using errcode='P0002'; end if;
    if v_line.amount <= 0 then raise exception 'Payment matches require positive bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Payment amount does not match bank line amount.' using errcode='23514'; end if;
    if exists(select 1 from public.bank_reconciliation_matches m where m.matched_entity_type='payment' and m.matched_entity_id=v_matched_entity_id and m.company_id=v_company_id) then raise exception 'Payment already matched to another bank line.' using errcode='23514'; end if;
  elsif v_matched_entity_type='receipt' then
    select r.amount,r.company_id,coalesce(r.status,'POSTED') into v_entity_amount,v_entity_company_id,v_entity_status from public.receipts r where r.id::text=v_matched_entity_id and r.company_id=v_company_id and r.deleted_at is null;
    if not found then raise exception 'Matched receipt was not found in the active company.' using errcode='P0002'; end if;
    if upper(v_entity_status) <> 'POSTED' then raise exception 'Receipt must be POSTED to be reconciled.' using errcode='23514'; end if;
    if v_line.amount <= 0 then raise exception 'Receipt matches require positive bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Receipt amount does not match bank line amount.' using errcode='23514'; end if;
  elsif v_matched_entity_type='expense' then
    select e.amount,e.company_id,coalesce(e.charged_to,'COMPANY') into v_entity_amount,v_entity_company_id,v_entity_status from public.expenses e where e.id::text=v_matched_entity_id and e.company_id=v_company_id and e.deleted_at is null;
    if not found then raise exception 'Matched expense was not found in the active company.' using errcode='P0002'; end if;
    if upper(v_entity_status) <> 'COMPANY' then raise exception 'Expense candidate must have charged_to=COMPANY for company expense type.' using errcode='23514'; end if;
    if v_line.amount >= 0 then raise exception 'Company expense matches require negative bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Expense amount does not match bank line amount.' using errcode='23514'; end if;
  elsif v_matched_entity_type='owner_expense' then
    select e.amount,e.company_id,coalesce(e.charged_to,'') into v_entity_amount,v_entity_company_id,v_entity_status from public.expenses e where e.id::text=v_matched_entity_id and e.company_id=v_company_id and e.deleted_at is null;
    if not found then raise exception 'Matched owner expense was not found.' using errcode='P0002'; end if;
    if upper(v_entity_status) <> 'OWNER' then raise exception 'Owner expense candidate must have charged_to=OWNER.' using errcode='23514'; end if;
    if v_line.amount >= 0 then raise exception 'Owner expense matches require negative bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Owner expense amount does not match bank line amount.' using errcode='23514'; end if;
  elsif v_matched_entity_type='owner_payout' then
    select s.net_payable,s.company_id,s.status into v_entity_amount,v_entity_company_id,v_entity_status from public.owner_settlements s where s.id::text=v_matched_entity_id and s.company_id=v_company_id;
    if not found then raise exception 'Matched owner payout was not found.' using errcode='P0002'; end if;
    if upper(v_entity_status) <> 'PAID' then raise exception 'Owner payout must be PAID to be reconciled.' using errcode='23514'; end if;
    if v_line.amount >= 0 then raise exception 'Owner payout matches require negative bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Owner payout amount does not match bank line amount.' using errcode='23514'; end if;
  elsif v_matched_entity_type='deposit_receipt' then
    select d.deposit_amount,d.company_id into v_entity_amount,v_entity_company_id from public.tenant_deposits d where d.id::text=v_matched_entity_id and d.company_id=v_company_id and d.deleted_at is null;
    if not found then raise exception 'Matched deposit receipt was not found.' using errcode='P0002'; end if;
    if v_line.amount <= 0 then raise exception 'Deposit receipt matches require positive bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Deposit receipt amount does not match bank line amount.' using errcode='23514'; end if;
  elsif v_matched_entity_type='deposit_refund' then
    select r.amount,r.company_id,r.status into v_entity_amount,v_entity_company_id,v_entity_status from public.deposit_refund_events r where r.id::text=v_matched_entity_id and r.company_id=v_company_id;
    if not found then raise exception 'Matched deposit refund was not found.' using errcode='P0002'; end if;
    if upper(v_entity_status) <> 'POSTED' then raise exception 'Deposit refund must be POSTED to be reconciled.' using errcode='23514'; end if;
    if v_line.amount >= 0 then raise exception 'Deposit refund matches require negative bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Deposit refund amount does not match bank line amount.' using errcode='23514'; end if;
  elsif v_matched_entity_type='receipt_void' then
    select r.amount,r.company_id,coalesce(r.status,'') into v_entity_amount,v_entity_company_id,v_entity_status from public.receipts r where r.id::text=v_matched_entity_id and r.company_id=v_company_id and r.deleted_at is null;
    if not found then raise exception 'Matched receipt void was not found in the active company.' using errcode='P0002'; end if;
    if upper(v_entity_status) not in ('VOID','VOIDED','REVERSED') then raise exception 'Receipt void match requires a voided/reversed receipt.' using errcode='23514'; end if;
    if v_line.amount >= 0 then raise exception 'Receipt void matches require negative bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Receipt void amount does not match bank line amount.' using errcode='23514'; end if;
    if not exists(select 1 from public.journal_batches original_batch join public.journal_batches reversal_batch on reversal_batch.company_id=original_batch.company_id and reversal_batch.reversal_of_batch_id=original_batch.id and upper(coalesce(reversal_batch.status,''))='POSTED' where original_batch.company_id=v_company_id and original_batch.source_type='receipt' and original_batch.source_id=v_matched_entity_id)
       and not exists(select 1 from public.journal_entries je where je.company_id=v_company_id and je.source_id=v_matched_entity_id and je.entity_type='receipt_void' and je.deleted_at is null)
    then raise exception 'Receipt void requires a persisted journal reversal authority.' using errcode='23514'; end if;
  elsif v_matched_entity_type='deposit_refund_reversal' then
    select r.amount,r.company_id,r.status into v_entity_amount,v_entity_company_id,v_entity_status from public.deposit_refund_events r where r.id::text=v_matched_entity_id and r.company_id=v_company_id and r.reversal_journal_batch_id is not null;
    if not found then raise exception 'Matched deposit refund reversal was not found.' using errcode='P0002'; end if;
    if upper(v_entity_status) <> 'REVERSED' then raise exception 'Deposit refund reversal must be REVERSED to be reconciled.' using errcode='23514'; end if;
    if v_line.amount <= 0 then raise exception 'Deposit refund reversal matches require positive bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Deposit refund reversal amount does not match bank line amount.' using errcode='23514'; end if;
  elsif v_matched_entity_type='commission_payment' then
    select c.amount,c.company_id,c.status into v_entity_amount,v_entity_company_id,v_entity_status from public.commissions c where c.id::text=v_matched_entity_id and c.company_id=v_company_id;
    if not found then raise exception 'Matched commission payment was not found.' using errcode='P0002'; end if;
    if upper(v_entity_status) <> 'PAID' then raise exception 'Commission payment must be PAID to be reconciled.' using errcode='23514'; end if;
    if v_line.amount >= 0 then raise exception 'Commission payment matches require negative bank amount.' using errcode='23514'; end if;
    if abs(v_entity_amount) <> abs(v_line.amount) then raise exception 'Commission payment amount does not match bank line amount.' using errcode='23514'; end if;
  elsif v_matched_entity_type='manual_adjustment' then
    if not exists(select 1 from public.journal_batches b where b.id::text=v_matched_entity_id and b.company_id=v_company_id and b.source_type='manual_adjustment' and b.status='POSTED') then raise exception 'Manual adjustment must reference real persisted POSTED journal_batches with source_type manual_adjustment.' using errcode='P0002'; end if;
  end if;

  insert into public.bank_reconciliation_matches(statement_line_id,matched_entity_type,matched_entity_id,matched_amount,notes,matched_by,company_id)
  values(v_statement_line_id,v_matched_entity_type,v_matched_entity_id,v_matched_amount,v_notes,auth.uid(),v_company_id) returning * into v_match;
  update public.bank_statement_lines set status='matched',updated_at=now() where id=v_statement_line_id and company_id=v_company_id;
  insert into public.audit_log(id,user_id,action,entity,entity_id,note,"table",old_value,new_value,action_timestamp,created_at,updated_at)
  values(gen_random_uuid()::text,auth.uid(),'PROCESS_BANK_RECONCILIATION_MATCH_ATOMIC','bank_reconciliation_match',v_match.id::text,'Bank statement line matched atomically through RPC with full validation (FOM-013).','bank_reconciliation_matches',to_jsonb(v_line),jsonb_build_object('match',to_jsonb(v_match),'statement_line_status','matched'),now(),now(),now());
  return v_match;
end;
$$;
alter function public.process_bank_reconciliation_match_atomic(jsonb) owner to postgres;
comment on function public.process_bank_reconciliation_match_atomic(jsonb) is 'RC1 Group 2: validates reconciliation entity/company/direction/amount/status, including receipt void and deposit refund reversal authority; prevents duplicate economic matches; manual adjustments must reference posted governed journals.';
comment on constraint bank_reconciliation_matches_type_chk on public.bank_reconciliation_matches is 'RC1 Group 2: includes deterministic receipt_void and deposit_refund_reversal match types; manual adjustments remain posted-journal only.';

commit;