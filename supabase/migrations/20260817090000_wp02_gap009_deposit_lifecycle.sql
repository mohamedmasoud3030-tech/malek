-- WP-02 / GAP-009: governed deposit beneficiary/application/refund/reversal lifecycle.
-- Canonical rules: FIN-009/FIN-010, D05.
-- Deposits remain 2200 liabilities until an evidence-backed approved allocation
-- is applied or a governed refund is posted. Corrections are compensating only.

begin;

create table if not exists public.deposit_application_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  deposit_id text not null,
  contract_id text not null,
  claim_kind text not null check (claim_kind in ('INVOICE_ARREARS','DAMAGE')),
  invoice_id text,
  allocation_amount numeric(18,3) not null check (allocation_amount > 0),
  evidence_uri text not null check (length(btrim(evidence_uri)) between 3 and 2000),
  claim_note text,
  target_type text not null check (target_type in ('rent_arrears','owner_arrears','damage')),
  target_account_no text not null check (target_account_no in ('1201','2000','4300')),
  collection_role_snapshot text,
  deposit_beneficiary_snapshot text,
  request_id text not null,
  source_fingerprint text not null,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','APPLIED','REVERSED')),
  created_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  rejected_by uuid,
  rejected_at timestamptz,
  rejection_reason text,
  application_request_id text,
  application_effective_date date,
  application_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  applied_by uuid,
  applied_at timestamptz,
  reversal_request_id text,
  reversal_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  reversal_reason text,
  reversed_by uuid,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint deposit_application_claims_request_uq unique(company_id, request_id),
  constraint deposit_application_claims_application_request_uq unique(company_id, application_request_id),
  constraint deposit_application_claims_reversal_request_uq unique(company_id, reversal_request_id),
  constraint deposit_application_claims_invoice_shape_chk check (
    (claim_kind = 'INVOICE_ARREARS' and invoice_id is not null)
    or (claim_kind = 'DAMAGE' and invoice_id is null)
  ),
  constraint deposit_application_claims_approval_shape_chk check (
    (status = 'PENDING')
    or (status = 'REJECTED' and rejected_by is not null and rejected_at is not null and nullif(btrim(rejection_reason),'') is not null)
    or (status in ('APPROVED','APPLIED','REVERSED') and approved_by is not null and approved_at is not null)
  ),
  constraint deposit_application_claims_applied_shape_chk check (
    status not in ('APPLIED','REVERSED')
    or (application_request_id is not null and application_effective_date is not null and application_journal_batch_id is not null and applied_by is not null and applied_at is not null)
  ),
  constraint deposit_application_claims_reversal_shape_chk check (
    status <> 'REVERSED'
    or (reversal_request_id is not null and reversal_journal_batch_id is not null and nullif(btrim(reversal_reason),'') is not null and reversed_by is not null and reversed_at is not null)
  )
);

create index if not exists deposit_application_claims_deposit_idx
  on public.deposit_application_claims(company_id, deposit_id, created_at desc);

create table if not exists public.deposit_refund_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  deposit_id text not null,
  amount numeric(18,3) not null check (amount > 0),
  cash_account_no text not null check (cash_account_no in ('1111','1120')),
  effective_date date not null,
  request_id text not null,
  source_fingerprint text not null,
  journal_batch_id uuid not null references public.journal_batches(id) on delete restrict,
  status text not null default 'POSTED' check (status in ('POSTED','REVERSED')),
  posted_by uuid not null,
  posted_at timestamptz not null default now(),
  reversal_request_id text,
  reversal_journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  reversal_reason text,
  reversed_by uuid,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint deposit_refund_events_request_uq unique(company_id, request_id),
  constraint deposit_refund_events_reversal_request_uq unique(company_id, reversal_request_id),
  constraint deposit_refund_events_reversal_shape_chk check (
    status <> 'REVERSED'
    or (reversal_request_id is not null and reversal_journal_batch_id is not null and nullif(btrim(reversal_reason),'') is not null and reversed_by is not null and reversed_at is not null)
  )
);

create index if not exists deposit_refund_events_deposit_idx
  on public.deposit_refund_events(company_id, deposit_id, effective_date desc, id);

alter table public.deposit_application_claims enable row level security;
alter table public.deposit_refund_events enable row level security;

drop policy if exists deposit_application_claims_company_read on public.deposit_application_claims;
create policy deposit_application_claims_company_read on public.deposit_application_claims
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin_or_manager() or public.is_accountant())
  );

drop policy if exists deposit_refund_events_company_read on public.deposit_refund_events;
create policy deposit_refund_events_company_read on public.deposit_refund_events
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (public.is_admin_or_manager() or public.is_accountant())
  );

revoke all on table public.deposit_application_claims from public, anon, authenticated;
revoke all on table public.deposit_refund_events from public, anon, authenticated;
grant select on table public.deposit_application_claims to authenticated;
grant select on table public.deposit_refund_events to authenticated;

create or replace function public.create_deposit_application_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_deposit_id text := nullif(btrim(coalesce(p_payload->>'deposit_id','')), '');
  v_kind text := upper(nullif(btrim(coalesce(p_payload->>'claim_kind','')), ''));
  v_invoice_id text := nullif(btrim(coalesce(p_payload->>'invoice_id','')), '');
  v_amount numeric := public.gl_pm_round_omr(nullif(p_payload->>'allocation_amount','')::numeric);
  v_evidence text := nullif(btrim(coalesce(p_payload->>'evidence_uri','')), '');
  v_note text := nullif(btrim(coalesce(p_payload->>'claim_note','')), '');
  v_contract_id text;
  v_collection_role text;
  v_beneficiary text;
  v_target_type text;
  v_target_no text;
  v_invoice_outstanding numeric;
  v_fingerprint text;
  v_existing public.deposit_application_claims%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DEPOSIT_CLAIM_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if not public.is_company_member(v_company_id, v_actor) then
    raise exception 'DEPOSIT_CLAIM_COMPANY_MEMBERSHIP_REQUIRED' using errcode = '42501';
  end if;
  if p_payload ?| array['company_id','target_type','target_account_no','collection_role','deposit_beneficiary','journal_lines'] then
    raise exception 'DEPOSIT_CLAIM_SERVER_OWNED_FIELDS_FORBIDDEN' using errcode = '22023';
  end if;
  if v_request_id is null or v_deposit_id is null or v_kind is null or v_amount is null or v_amount <= 0 or v_evidence is null then
    raise exception 'DEPOSIT_CLAIM_REQUEST_DEPOSIT_KIND_AMOUNT_EVIDENCE_REQUIRED' using errcode = '22023';
  end if;
  if v_kind not in ('INVOICE_ARREARS','DAMAGE') then
    raise exception 'DEPOSIT_CLAIM_KIND_INVALID' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('deposit_claim:'||v_company_id::text||':'||v_request_id,0));

  select c.id::text, c.collection_role_snapshot, av.deposit_beneficiary
    into v_contract_id, v_collection_role, v_beneficiary
  from public.tenant_deposits d
  join public.contracts c on c.id::text = d.contract_id::text and c.company_id = v_company_id and c.deleted_at is null
  left join public.owner_agreement_versions av on av.id = c.agreement_version_id and av.company_id = v_company_id
  where d.id::text = v_deposit_id and d.company_id = v_company_id and d.deleted_at is null;
  if not found then
    raise exception 'DEPOSIT_CLAIM_DEPOSIT_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if v_kind = 'INVOICE_ARREARS' then
    if v_invoice_id is null then
      raise exception 'DEPOSIT_CLAIM_INVOICE_REQUIRED' using errcode = '22023';
    end if;
    select public.gl_pm_round_omr(coalesce(i.amount,0) + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0))
      into v_invoice_outstanding
    from public.invoices i
    where i.id::text = v_invoice_id
      and i.company_id = v_company_id
      and i.contract_id::text = v_contract_id
      and i.deleted_at is null;
    if not found or v_invoice_outstanding <= 0 or v_amount > v_invoice_outstanding then
      raise exception 'DEPOSIT_CLAIM_INVOICE_NOT_OPEN_OR_ALLOCATION_EXCEEDS_OUTSTANDING' using errcode = '22023';
    end if;
    if v_collection_role = 'OFFICE_IS_CREDITOR' then
      v_target_type := 'rent_arrears'; v_target_no := '1201';
    elsif v_collection_role = 'OWNER_IS_CREDITOR' then
      v_target_type := 'owner_arrears'; v_target_no := '2000';
    else
      raise exception 'DEPOSIT_CLAIM_COLLECTION_ROLE_MISSING' using errcode = '23514';
    end if;
  else
    v_invoice_id := null;
    v_target_type := 'damage';
    if v_beneficiary = 'OWNER' then
      v_target_no := '2000';
    elsif v_beneficiary = 'OFFICE' then
      v_target_no := '4300';
    else
      raise exception 'DEPOSIT_CLAIM_DAMAGE_BENEFICIARY_MISSING' using errcode = '23514';
    end if;
  end if;

  v_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'deposit_id',v_deposit_id,'claim_kind',v_kind,'invoice_id',v_invoice_id,
    'allocation_amount',v_amount,'evidence_uri',v_evidence,'claim_note',v_note,
    'contract_id',v_contract_id,'target_type',v_target_type,'target_account_no',v_target_no,
    'collection_role',v_collection_role,'deposit_beneficiary',v_beneficiary
  )::text,'UTF8')),'hex');

  select * into v_existing from public.deposit_application_claims
   where company_id=v_company_id and request_id=v_request_id;
  if found then
    if v_existing.source_fingerprint <> v_fingerprint then
      raise exception 'DEPOSIT_CLAIM_IDEMPOTENCY_CONFLICT' using errcode = '22023';
    end if;
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_existing.id,'status',v_existing.status);
  end if;

  insert into public.deposit_application_claims(
    id,company_id,deposit_id,contract_id,claim_kind,invoice_id,allocation_amount,evidence_uri,claim_note,
    target_type,target_account_no,collection_role_snapshot,deposit_beneficiary_snapshot,
    request_id,source_fingerprint,status,created_by
  ) values (
    v_id,v_company_id,v_deposit_id,v_contract_id,v_kind,v_invoice_id,v_amount,v_evidence,v_note,
    v_target_type,v_target_no,v_collection_role,v_beneficiary,
    v_request_id,v_fingerprint,'PENDING',v_actor
  );

  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_id,'status','PENDING','target_type',v_target_type);
end;
$fn$;

alter function public.create_deposit_application_claim_atomic(jsonb) owner to postgres;
revoke all on function public.create_deposit_application_claim_atomic(jsonb) from public, anon;
grant execute on function public.create_deposit_application_claim_atomic(jsonb) to authenticated, service_role;

create or replace function public.approve_deposit_application_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_claim_id uuid := nullif(p_payload->>'claim_id','')::uuid;
  v_claim public.deposit_application_claims%rowtype;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DEPOSIT_CLAIM_APPROVER_ROLE_REQUIRED' using errcode='42501';
  end if;
  v_company_id := public.require_company_id();
  select * into v_claim from public.deposit_application_claims
   where id=v_claim_id and company_id=v_company_id for update;
  if not found then raise exception 'DEPOSIT_CLAIM_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.status='APPROVED' then
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'status',v_claim.status);
  end if;
  if v_claim.status<>'PENDING' then raise exception 'DEPOSIT_CLAIM_NOT_PENDING' using errcode='22023'; end if;
  if v_claim.created_by=v_actor then raise exception 'DEPOSIT_CLAIM_MAKER_CHECKER_REQUIRED' using errcode='42501'; end if;
  update public.deposit_application_claims
     set status='APPROVED',approved_by=v_actor,approved_at=now(),updated_at=now()
   where id=v_claim.id;
  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_claim.id,'status','APPROVED');
end;
$fn$;

alter function public.approve_deposit_application_claim_atomic(jsonb) owner to postgres;
revoke all on function public.approve_deposit_application_claim_atomic(jsonb) from public, anon;
grant execute on function public.approve_deposit_application_claim_atomic(jsonb) to authenticated, service_role;

create or replace function public.apply_deposit_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_claim_id uuid := nullif(p_payload->>'claim_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_effective_date date := nullif(p_payload->>'effective_date','')::date;
  v_claim public.deposit_application_claims%rowtype;
  v_remaining numeric;
  v_deducted numeric;
  v_invoice_outstanding numeric;
  v_dep_account text;
  v_target_account text;
  v_post jsonb;
  v_batch_id uuid;
  v_rows integer;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DEPOSIT_APPLICATION_ROLE_REQUIRED' using errcode='42501';
  end if;
  v_company_id := public.require_company_id();
  if p_payload ?| array['company_id','amount','allocation_amount','target_type','target_account_no','lines'] then
    raise exception 'DEPOSIT_APPLICATION_CLIENT_FINANCIAL_INPUT_FORBIDDEN' using errcode='22023';
  end if;
  if v_claim_id is null or v_request_id is null or v_effective_date is null then
    raise exception 'DEPOSIT_APPLICATION_CLAIM_REQUEST_DATE_REQUIRED' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('deposit_apply:'||v_company_id::text||':'||v_claim_id::text,0));
  select * into v_claim from public.deposit_application_claims
   where id=v_claim_id and company_id=v_company_id for update;
  if not found then raise exception 'DEPOSIT_CLAIM_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.status='APPLIED' then
    if v_claim.application_request_id<>v_request_id then raise exception 'DEPOSIT_APPLICATION_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'batch_id',v_claim.application_journal_batch_id,'status','APPLIED');
  end if;
  if v_claim.status<>'APPROVED' then raise exception 'DEPOSIT_APPLICATION_APPROVED_CLAIM_REQUIRED' using errcode='22023'; end if;

  select d.remaining_amount,d.deducted_amount into v_remaining,v_deducted
  from public.tenant_deposits d
  where d.id::text=v_claim.deposit_id and d.company_id=v_company_id and d.deleted_at is null
  for update;
  if not found then raise exception 'DEPOSIT_APPLICATION_DEPOSIT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.allocation_amount>v_remaining then raise exception 'DEPOSIT_APPLICATION_EXCEEDS_REMAINING' using errcode='22023'; end if;

  if v_claim.claim_kind='INVOICE_ARREARS' then
    select public.gl_pm_round_omr(coalesce(i.amount,0)+coalesce(i.tax_amount,0)-coalesce(i.paid_amount,0))
      into v_invoice_outstanding
    from public.invoices i
    where i.id::text=v_claim.invoice_id and i.company_id=v_company_id and i.contract_id::text=v_claim.contract_id and i.deleted_at is null;
    if not found or v_invoice_outstanding<=0 or v_claim.allocation_amount>v_invoice_outstanding then
      raise exception 'DEPOSIT_APPLICATION_INVOICE_NO_LONGER_ELIGIBLE' using errcode='22023';
    end if;
  end if;

  v_dep_account := public.gl_pm_require_account(v_company_id,'2200');
  v_target_account := public.gl_pm_require_account(v_company_id,v_claim.target_account_no);
  v_post := public.post_journal_event(jsonb_build_object(
    'company_id',v_company_id,'source_type','pm_deposit_application','source_id',v_claim.id::text,
    'event_id','apply','effective_date',v_effective_date,
    'description','Approved evidence-backed deposit application',
    'lines',jsonb_build_array(
      jsonb_build_object('account_id',v_dep_account,'debit',v_claim.allocation_amount,'credit',0,'ref_source_id',v_claim.id::text,'ref_entity_type','deposit_claim','ref_entity_id',v_claim.deposit_id),
      jsonb_build_object('account_id',v_target_account,'debit',0,'credit',v_claim.allocation_amount,'ref_source_id',v_claim.id::text,'ref_entity_type','deposit_claim','ref_entity_id',coalesce(v_claim.invoice_id,v_claim.id::text))
    )
  ));
  v_batch_id := (v_post->>'batch_id')::uuid;

  insert into public.deposit_transactions(deposit_id,type,amount,reason,description,request_id,company_id)
  values(v_claim.deposit_id,'deduction',v_claim.allocation_amount,
    case when v_claim.claim_kind='DAMAGE' then 'maintenance_damage' else 'unpaid_arrears' end,
    'Governed deposit claim '||v_claim.id::text,v_request_id,v_company_id)
  on conflict(request_id) do nothing;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'DEPOSIT_APPLICATION_TRANSACTION_CONFLICT' using errcode='23505'; end if;

  update public.tenant_deposits
     set deducted_amount=public.gl_pm_round_omr(deducted_amount+v_claim.allocation_amount),
         remaining_amount=public.gl_pm_round_omr(remaining_amount-v_claim.allocation_amount),
         status=case when public.gl_pm_round_omr(remaining_amount-v_claim.allocation_amount)=0
              then case when v_claim.claim_kind='DAMAGE' then 'forfeited_damage' else 'forfeited_arrears' end
              else 'partially_deducted' end,
         settled_date=case when public.gl_pm_round_omr(remaining_amount-v_claim.allocation_amount)=0 then v_effective_date else settled_date end,
         updated_at=now()
   where id::text=v_claim.deposit_id and company_id=v_company_id;

  update public.deposit_application_claims
     set status='APPLIED',application_request_id=v_request_id,application_effective_date=v_effective_date,
         application_journal_batch_id=v_batch_id,applied_by=v_actor,applied_at=now(),updated_at=now()
   where id=v_claim.id;

  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_claim.id,'deposit_id',v_claim.deposit_id,
    'amount',v_claim.allocation_amount,'target_account_no',v_claim.target_account_no,'batch_id',v_batch_id,'status','APPLIED');
end;
$fn$;

alter function public.apply_deposit_claim_atomic(jsonb) owner to postgres;
revoke all on function public.apply_deposit_claim_atomic(jsonb) from public, anon;
grant execute on function public.apply_deposit_claim_atomic(jsonb) to authenticated, service_role;

create or replace function public.reverse_deposit_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid:=auth.uid(); v_company_id uuid;
  v_claim_id uuid:=nullif(p_payload->>'claim_id','')::uuid;
  v_request_id text:=nullif(btrim(coalesce(p_payload->>'request_id','')),'');
  v_reason text:=nullif(btrim(coalesce(p_payload->>'reason','')),'');
  v_claim public.deposit_application_claims%rowtype; v_rev jsonb; v_rev_batch uuid;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then raise exception 'DEPOSIT_REVERSAL_ROLE_REQUIRED' using errcode='42501'; end if;
  v_company_id:=public.require_company_id();
  if v_claim_id is null or v_request_id is null or v_reason is null or length(v_reason)<3 then raise exception 'DEPOSIT_REVERSAL_CLAIM_REQUEST_REASON_REQUIRED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('deposit_claim_reverse:'||v_company_id::text||':'||v_claim_id::text,0));
  select * into v_claim from public.deposit_application_claims where id=v_claim_id and company_id=v_company_id for update;
  if not found then raise exception 'DEPOSIT_CLAIM_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.status='REVERSED' then
    if v_claim.reversal_request_id<>v_request_id then raise exception 'DEPOSIT_REVERSAL_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'reversal_batch_id',v_claim.reversal_journal_batch_id,'status','REVERSED');
  end if;
  if v_claim.status<>'APPLIED' or v_claim.application_journal_batch_id is null then raise exception 'DEPOSIT_REVERSAL_APPLIED_CLAIM_REQUIRED' using errcode='22023'; end if;

  v_rev:=public.reverse_journal_batch(v_claim.application_journal_batch_id);
  v_rev_batch:=(v_rev->>'reversal_batch_id')::uuid;
  insert into public.deposit_transactions(deposit_id,type,amount,reason,description,request_id,company_id)
  values(v_claim.deposit_id,'reversal',v_claim.allocation_amount,'claim_reversal','Compensating reversal of governed deposit claim '||v_claim.id::text,v_request_id,v_company_id);

  update public.tenant_deposits
     set deducted_amount=public.gl_pm_round_omr(deducted_amount-v_claim.allocation_amount),
         remaining_amount=public.gl_pm_round_omr(remaining_amount+v_claim.allocation_amount),
         status=case
           when public.gl_pm_round_omr(remaining_amount+v_claim.allocation_amount)=deposit_amount then 'held'
           when public.gl_pm_round_omr(deducted_amount-v_claim.allocation_amount)>0 then 'partially_deducted'
           when refunded_amount>0 then 'partially_refunded' else 'held' end,
         settled_date=null,updated_at=now()
   where id::text=v_claim.deposit_id and company_id=v_company_id;

  update public.deposit_application_claims
     set status='REVERSED',reversal_request_id=v_request_id,reversal_journal_batch_id=v_rev_batch,
         reversal_reason=v_reason,reversed_by=v_actor,reversed_at=now(),updated_at=now()
   where id=v_claim.id;
  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_claim.id,'reversal_batch_id',v_rev_batch,'status','REVERSED');
end;
$fn$;

alter function public.reverse_deposit_claim_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_deposit_claim_atomic(jsonb) from public, anon;
grant execute on function public.reverse_deposit_claim_atomic(jsonb) to authenticated, service_role;

create or replace function public.refund_deposit_governed_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid:=auth.uid(); v_company_id uuid;
  v_deposit_id text:=nullif(btrim(coalesce(p_payload->>'deposit_id','')),'');
  v_request_id text:=nullif(btrim(coalesce(p_payload->>'request_id','')),'');
  v_amount numeric:=public.gl_pm_round_omr(nullif(p_payload->>'amount','')::numeric);
  v_date date:=nullif(p_payload->>'refund_date','')::date;
  v_method text:=lower(coalesce(nullif(p_payload->>'payment_method',''),'bank_transfer'));
  v_cash_no text; v_remaining numeric; v_refunded numeric; v_dep_account text; v_cash_account text;
  v_fp text; v_existing public.deposit_refund_events%rowtype; v_post jsonb; v_batch uuid; v_id uuid:=gen_random_uuid();
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then raise exception 'DEPOSIT_REFUND_ROLE_REQUIRED' using errcode='42501'; end if;
  v_company_id:=public.require_company_id();
  if p_payload ? 'company_id' then raise exception 'DEPOSIT_REFUND_COMPANY_SERVER_OWNED' using errcode='22023'; end if;
  if v_deposit_id is null or v_request_id is null or v_amount is null or v_amount<=0 or v_date is null then raise exception 'DEPOSIT_REFUND_DEPOSIT_REQUEST_AMOUNT_DATE_REQUIRED' using errcode='22023'; end if;
  if v_method not in ('cash','bank_transfer','check') then raise exception 'DEPOSIT_REFUND_METHOD_INVALID' using errcode='22023'; end if;
  v_cash_no:=case when v_method='cash' then '1111' else '1120' end;
  v_fp:=encode(sha256(convert_to(jsonb_build_object('deposit_id',v_deposit_id,'amount',v_amount,'date',v_date,'method',v_method)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('deposit_refund:'||v_company_id::text||':'||v_request_id,0));
  select * into v_existing from public.deposit_refund_events where company_id=v_company_id and request_id=v_request_id;
  if found then
    if v_existing.source_fingerprint<>v_fp then raise exception 'DEPOSIT_REFUND_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'refund_event_id',v_existing.id,'status',v_existing.status,'batch_id',v_existing.journal_batch_id);
  end if;
  select remaining_amount,refunded_amount into v_remaining,v_refunded from public.tenant_deposits
   where id::text=v_deposit_id and company_id=v_company_id and deleted_at is null for update;
  if not found then raise exception 'DEPOSIT_REFUND_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_amount>v_remaining then raise exception 'DEPOSIT_REFUND_EXCEEDS_REMAINING' using errcode='22023'; end if;
  v_dep_account:=public.gl_pm_require_account(v_company_id,'2200'); v_cash_account:=public.gl_pm_require_account(v_company_id,v_cash_no);
  v_post:=public.post_journal_event(jsonb_build_object('company_id',v_company_id,'source_type','pm_deposit_refund','source_id',v_id::text,'event_id','refund',
    'effective_date',v_date,'description','Governed tenant deposit refund',
    'lines',jsonb_build_array(jsonb_build_object('account_id',v_dep_account,'debit',v_amount,'credit',0),jsonb_build_object('account_id',v_cash_account,'debit',0,'credit',v_amount))));
  v_batch:=(v_post->>'batch_id')::uuid;
  insert into public.deposit_transactions(deposit_id,type,amount,reason,description,payment_method,request_id,company_id)
  values(v_deposit_id,'refund',v_amount,'refund_partial','Governed deposit refund',v_method,v_request_id,v_company_id);
  update public.tenant_deposits set refunded_amount=public.gl_pm_round_omr(refunded_amount+v_amount),remaining_amount=public.gl_pm_round_omr(remaining_amount-v_amount),
    status=case when public.gl_pm_round_omr(remaining_amount-v_amount)=0 then 'refunded' else 'partially_refunded' end,
    settled_date=case when public.gl_pm_round_omr(remaining_amount-v_amount)=0 then v_date else settled_date end,updated_at=now()
   where id::text=v_deposit_id and company_id=v_company_id;
  insert into public.deposit_refund_events(id,company_id,deposit_id,amount,cash_account_no,effective_date,request_id,source_fingerprint,journal_batch_id,posted_by)
  values(v_id,v_company_id,v_deposit_id,v_amount,v_cash_no,v_date,v_request_id,v_fp,v_batch,v_actor);
  return jsonb_build_object('success',true,'idempotent',false,'refund_event_id',v_id,'amount',v_amount,'batch_id',v_batch,'status','POSTED');
end;
$fn$;

alter function public.refund_deposit_governed_atomic(jsonb) owner to postgres;
revoke all on function public.refund_deposit_governed_atomic(jsonb) from public, anon;
grant execute on function public.refund_deposit_governed_atomic(jsonb) to authenticated, service_role;

create or replace function public.reverse_deposit_refund_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
 v_actor uuid:=auth.uid(); v_company_id uuid; v_event_id uuid:=nullif(p_payload->>'refund_event_id','')::uuid;
 v_request_id text:=nullif(btrim(coalesce(p_payload->>'request_id','')),''); v_reason text:=nullif(btrim(coalesce(p_payload->>'reason','')),'');
 v_event public.deposit_refund_events%rowtype; v_rev jsonb; v_rev_batch uuid;
begin
 if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then raise exception 'DEPOSIT_REFUND_REVERSAL_ROLE_REQUIRED' using errcode='42501'; end if;
 v_company_id:=public.require_company_id();
 if v_event_id is null or v_request_id is null or v_reason is null or length(v_reason)<3 then raise exception 'DEPOSIT_REFUND_REVERSAL_EVENT_REQUEST_REASON_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('deposit_refund_reverse:'||v_company_id::text||':'||v_event_id::text,0));
 select * into v_event from public.deposit_refund_events where id=v_event_id and company_id=v_company_id for update;
 if not found then raise exception 'DEPOSIT_REFUND_EVENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
 if v_event.status='REVERSED' then
   if v_event.reversal_request_id<>v_request_id then raise exception 'DEPOSIT_REFUND_REVERSAL_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
   return jsonb_build_object('success',true,'idempotent',true,'refund_event_id',v_event.id,'status','REVERSED','reversal_batch_id',v_event.reversal_journal_batch_id);
 end if;
 v_rev:=public.reverse_journal_batch(v_event.journal_batch_id); v_rev_batch:=(v_rev->>'reversal_batch_id')::uuid;
 insert into public.deposit_transactions(deposit_id,type,amount,reason,description,request_id,company_id)
 values(v_event.deposit_id,'reversal',v_event.amount,'refund_reversal','Compensating reversal of deposit refund '||v_event.id::text,v_request_id,v_company_id);
 update public.tenant_deposits set refunded_amount=public.gl_pm_round_omr(refunded_amount-v_event.amount),remaining_amount=public.gl_pm_round_omr(remaining_amount+v_event.amount),
   status=case when public.gl_pm_round_omr(remaining_amount+v_event.amount)=deposit_amount then 'held' when deducted_amount>0 then 'partially_deducted' when public.gl_pm_round_omr(refunded_amount-v_event.amount)>0 then 'partially_refunded' else 'held' end,
   settled_date=null,updated_at=now() where id::text=v_event.deposit_id and company_id=v_company_id;
 update public.deposit_refund_events set status='REVERSED',reversal_request_id=v_request_id,reversal_journal_batch_id=v_rev_batch,reversal_reason=v_reason,reversed_by=v_actor,reversed_at=now()
  where id=v_event.id;
 return jsonb_build_object('success',true,'idempotent',false,'refund_event_id',v_event.id,'status','REVERSED','reversal_batch_id',v_rev_batch);
end;
$fn$;

alter function public.reverse_deposit_refund_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_deposit_refund_atomic(jsonb) from public, anon;
grant execute on function public.reverse_deposit_refund_atomic(jsonb) to authenticated, service_role;

-- Close legacy bypasses. Receipt creation remains available because FIN-009 is
-- already governed; application/refund writes must use the GAP-009 paths above.
revoke execute on function public.gl_pm_post_deposit_application(jsonb) from service_role;
revoke execute on function public.gl_pm_post_deposit_refund(jsonb) from service_role;
revoke execute on function public.deduct_deposit_atomic(jsonb) from authenticated, service_role;
revoke execute on function public.refund_deposit_atomic(jsonb) from authenticated, service_role;

-- RPC/server-owned writes only: revoke the legacy authenticated direct-write
-- grants on the deposit financial tables. Browser reads remain available.
revoke insert, update, delete on table public.tenant_deposits from authenticated;
revoke insert, update, delete on table public.deposit_transactions from authenticated;
grant select on table public.tenant_deposits to authenticated;
grant select on table public.deposit_transactions to authenticated;

comment on table public.deposit_application_claims is 'GAP-009 immutable-source claim/allocation authority for deposit applications; target accounting is server-derived and maker-checker approved.';
comment on table public.deposit_refund_events is 'GAP-009 append-only source events for governed deposit refunds and compensating reversals.';


-- ═════════════════════════════════════════════════════════════════════════════
-- GAP-009 completion layer (same migration, supersedes the RPCs above):
--   * INVOICE_ARREARS applications now settle the authoritative invoice
--     subledger atomically (paid_amount + canonical status) so GL 1201 and the
--     invoice/tenant-receivable operational subledger can never diverge;
--   * reversing an application atomically restores the invoice position and
--     fails closed if downstream state (VOID invoice / insufficient paid
--     amount) makes restoration impossible;
--   * every deposit_transactions row is linked to its GL batch (original and
--     compensating reversal) for full-lifecycle reconciliation;
--   * governed claim rejection RPC;
--   * create_deposit_atomic is superseded onto the canonical engine
--     (gl_pm_post_deposit_receipt) so the receive path no longer writes
--     through the legacy journal_entries compatibility surface and its held
--     transaction is batch-linked and company-scoped idempotent.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Apply: invoice subledger parity + batch linkage
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.apply_deposit_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_claim_id uuid := nullif(p_payload->>'claim_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_effective_date date := nullif(p_payload->>'effective_date','')::date;
  v_claim public.deposit_application_claims%rowtype;
  v_remaining numeric;
  v_deducted numeric;
  v_invoice_outstanding numeric;
  v_invoice_id uuid;
  v_dep_account text;
  v_target_account text;
  v_post jsonb;
  v_batch_id uuid;
  v_rows integer;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DEPOSIT_APPLICATION_ROLE_REQUIRED' using errcode='42501';
  end if;
  v_company_id := public.require_company_id();
  if p_payload ?| array['company_id','amount','allocation_amount','target_type','target_account_no','lines'] then
    raise exception 'DEPOSIT_APPLICATION_CLIENT_FINANCIAL_INPUT_FORBIDDEN' using errcode='22023';
  end if;
  if v_claim_id is null or v_request_id is null or v_effective_date is null then
    raise exception 'DEPOSIT_APPLICATION_CLAIM_REQUEST_DATE_REQUIRED' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('deposit_apply:'||v_company_id::text||':'||v_claim_id::text,0));
  select * into v_claim from public.deposit_application_claims
   where id=v_claim_id and company_id=v_company_id for update;
  if not found then raise exception 'DEPOSIT_CLAIM_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.status='APPLIED' then
    if v_claim.application_request_id<>v_request_id then raise exception 'DEPOSIT_APPLICATION_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'batch_id',v_claim.application_journal_batch_id,'status','APPLIED');
  end if;
  if v_claim.status<>'APPROVED' then raise exception 'DEPOSIT_APPLICATION_APPROVED_CLAIM_REQUIRED' using errcode='22023'; end if;

  select d.remaining_amount,d.deducted_amount into v_remaining,v_deducted
  from public.tenant_deposits d
  where d.id::text=v_claim.deposit_id and d.company_id=v_company_id and d.deleted_at is null
  for update;
  if not found then raise exception 'DEPOSIT_APPLICATION_DEPOSIT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.allocation_amount>v_remaining then raise exception 'DEPOSIT_APPLICATION_EXCEEDS_REMAINING' using errcode='22023'; end if;

  -- Re-validate the invoice at apply time (stale-invoice protection): the
  -- invoice must still exist, be company/contract scoped, not VOID/CANCELLED,
  -- and still have at least the allocation amount outstanding.
  if v_claim.claim_kind='INVOICE_ARREARS' then
    select i.id, public.gl_pm_round_omr(coalesce(i.amount,0)+coalesce(i.tax_amount,0)-coalesce(i.paid_amount,0))
      into v_invoice_id, v_invoice_outstanding
    from public.invoices i
    where i.id::text=v_claim.invoice_id
      and i.company_id=v_company_id
      and i.contract_id::text=v_claim.contract_id
      and i.deleted_at is null
      and coalesce(upper(i.status::text),'') not in ('VOID','VOIDED','CANCELLED')
    for update;
    if not found or v_invoice_outstanding<=0 or v_claim.allocation_amount>v_invoice_outstanding then
      raise exception 'DEPOSIT_APPLICATION_INVOICE_NO_LONGER_ELIGIBLE' using errcode='22023';
    end if;
  end if;

  v_dep_account := public.gl_pm_require_account(v_company_id,'2200');
  v_target_account := public.gl_pm_require_account(v_company_id,v_claim.target_account_no);
  v_post := public.post_journal_event(jsonb_build_object(
    'company_id',v_company_id,'source_type','pm_deposit_application','source_id',v_claim.id::text,
    'event_id','apply','effective_date',v_effective_date,
    'description','Approved evidence-backed deposit application',
    'lines',jsonb_build_array(
      jsonb_build_object('account_id',v_dep_account,'debit',v_claim.allocation_amount,'credit',0,'ref_source_id',v_claim.id::text,'ref_entity_type','deposit_claim','ref_entity_id',v_claim.deposit_id),
      jsonb_build_object('account_id',v_target_account,'debit',0,'credit',v_claim.allocation_amount,'ref_source_id',v_claim.id::text,'ref_entity_type','deposit_claim','ref_entity_id',coalesce(v_claim.invoice_id,v_claim.id::text))
    )
  ));
  v_batch_id := (v_post->>'batch_id')::uuid;

  -- GAP-009 subledger parity: an OFFICE-creditor arrears application settles
  -- the authoritative invoice/tenant-receivable operational subledger
  -- atomically with the GL posting (same mechanism post_receipt_atomic uses).
  -- OWNER-creditor arrears post to 2000 and intentionally leave the
  -- operational tenant AR untouched (FIN-003: tenant AR remains operational).
  if v_claim.claim_kind='INVOICE_ARREARS' and v_claim.target_account_no='1201' and v_invoice_id is not null then
    update public.invoices
       set paid_amount = public.gl_pm_round_omr(coalesce(paid_amount,0) + v_claim.allocation_amount),
           updated_at = now()
     where id = v_invoice_id and company_id = v_company_id;
    perform public.recalculate_invoice_status(v_invoice_id);
  end if;

  insert into public.deposit_transactions(deposit_id,type,amount,reason,description,request_id,company_id,journal_batch_id)
  values(v_claim.deposit_id,'deduction',v_claim.allocation_amount,
    case when v_claim.claim_kind='DAMAGE' then 'maintenance_damage' else 'unpaid_arrears' end,
    'Governed deposit claim '||v_claim.id::text,v_request_id,v_company_id,v_batch_id)
  on conflict(request_id) do nothing;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'DEPOSIT_APPLICATION_TRANSACTION_CONFLICT' using errcode='23505'; end if;

  update public.tenant_deposits
     set deducted_amount=public.gl_pm_round_omr(deducted_amount+v_claim.allocation_amount),
         remaining_amount=public.gl_pm_round_omr(remaining_amount-v_claim.allocation_amount),
         status=case when public.gl_pm_round_omr(remaining_amount-v_claim.allocation_amount)=0
              then case when v_claim.claim_kind='DAMAGE' then 'forfeited_damage' else 'forfeited_arrears' end
              else 'partially_deducted' end,
         settled_date=case when public.gl_pm_round_omr(remaining_amount-v_claim.allocation_amount)=0 then v_effective_date else settled_date end,
         updated_at=now()
   where id::text=v_claim.deposit_id and company_id=v_company_id;

  update public.deposit_application_claims
     set status='APPLIED',application_request_id=v_request_id,application_effective_date=v_effective_date,
         application_journal_batch_id=v_batch_id,applied_by=v_actor,applied_at=now(),updated_at=now()
   where id=v_claim.id;

  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_claim.id,'deposit_id',v_claim.deposit_id,
    'amount',v_claim.allocation_amount,'target_account_no',v_claim.target_account_no,'batch_id',v_batch_id,
    'invoice_id',v_claim.invoice_id,'status','APPLIED');
end;
$fn$;

alter function public.apply_deposit_claim_atomic(jsonb) owner to postgres;
revoke all on function public.apply_deposit_claim_atomic(jsonb) from public, anon;
grant execute on function public.apply_deposit_claim_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Claim rejection (maker/checker with mandatory reason; no economic effect)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reject_deposit_application_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_claim_id uuid := nullif(p_payload->>'claim_id','')::uuid;
  v_reason text := nullif(btrim(coalesce(p_payload->>'reason','')), '');
  v_claim public.deposit_application_claims%rowtype;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'DEPOSIT_CLAIM_REJECTION_ROLE_REQUIRED' using errcode='42501';
  end if;
  v_company_id := public.require_company_id();
  if v_claim_id is null or v_reason is null or length(v_reason)<3 then
    raise exception 'DEPOSIT_CLAIM_REJECTION_CLAIM_REASON_REQUIRED' using errcode='22023';
  end if;
  select * into v_claim from public.deposit_application_claims
   where id=v_claim_id and company_id=v_company_id for update;
  if not found then raise exception 'DEPOSIT_CLAIM_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.status='REJECTED' then
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'status','REJECTED');
  end if;
  if v_claim.status<>'PENDING' then raise exception 'DEPOSIT_CLAIM_NOT_PENDING' using errcode='22023'; end if;
  if v_claim.created_by=v_actor then raise exception 'DEPOSIT_CLAIM_MAKER_CHECKER_REQUIRED' using errcode='42501'; end if;
  update public.deposit_application_claims
     set status='REJECTED',rejected_by=v_actor,rejected_at=now(),rejection_reason=v_reason,updated_at=now()
   where id=v_claim.id;
  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_claim.id,'status','REJECTED');
end;
$fn$;

alter function public.reject_deposit_application_claim_atomic(jsonb) owner to postgres;
revoke all on function public.reject_deposit_application_claim_atomic(jsonb) from public, anon;
grant execute on function public.reject_deposit_application_claim_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Claim reversal: atomic invoice restoration + reversal batch linkage
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reverse_deposit_claim_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid:=auth.uid(); v_company_id uuid;
  v_claim_id uuid:=nullif(p_payload->>'claim_id','')::uuid;
  v_request_id text:=nullif(btrim(coalesce(p_payload->>'request_id','')),'');
  v_reason text:=nullif(btrim(coalesce(p_payload->>'reason','')),'');
  v_claim public.deposit_application_claims%rowtype; v_rev jsonb; v_rev_batch uuid;
  v_invoice_id uuid; v_invoice_paid numeric;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then raise exception 'DEPOSIT_REVERSAL_ROLE_REQUIRED' using errcode='42501'; end if;
  v_company_id:=public.require_company_id();
  if v_claim_id is null or v_request_id is null or v_reason is null or length(v_reason)<3 then raise exception 'DEPOSIT_REVERSAL_CLAIM_REQUEST_REASON_REQUIRED' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('deposit_claim_reverse:'||v_company_id::text||':'||v_claim_id::text,0));
  select * into v_claim from public.deposit_application_claims where id=v_claim_id and company_id=v_company_id for update;
  if not found then raise exception 'DEPOSIT_CLAIM_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_claim.status='REVERSED' then
    if v_claim.reversal_request_id<>v_request_id then raise exception 'DEPOSIT_REVERSAL_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'claim_id',v_claim.id,'reversal_batch_id',v_claim.reversal_journal_batch_id,'status','REVERSED');
  end if;
  if v_claim.status<>'APPLIED' or v_claim.application_journal_batch_id is null then raise exception 'DEPOSIT_REVERSAL_APPLIED_CLAIM_REQUIRED' using errcode='22023'; end if;

  -- Reversal-after-downstream-incompatible-state protection: an OFFICE-creditor
  -- arrears reversal must atomically restore the invoice subledger. If the
  -- invoice was voided/cancelled after application, or its paid amount no
  -- longer covers the allocation, the reversal fails closed and must be
  -- handled through the governed review path.
  if v_claim.claim_kind='INVOICE_ARREARS' and v_claim.target_account_no='1201' and v_claim.invoice_id is not null then
    select i.id, coalesce(i.paid_amount,0)
      into v_invoice_id, v_invoice_paid
    from public.invoices i
    where i.id::text=v_claim.invoice_id
      and i.company_id=v_company_id
      and i.deleted_at is null
      and coalesce(upper(i.status::text),'') not in ('VOID','VOIDED','CANCELLED')
    for update;
    if not found then
      raise exception 'DEPOSIT_REVERSAL_INVOICE_STATE_INVALID: the settled invoice is no longer open.' using errcode='22023';
    end if;
    if v_invoice_paid < v_claim.allocation_amount - 0.001 then
      raise exception 'DEPOSIT_REVERSAL_INVOICE_PAID_INSUFFICIENT: invoice paid amount no longer covers the allocation.' using errcode='22023';
    end if;
  end if;

  v_rev:=public.reverse_journal_batch(v_claim.application_journal_batch_id);
  v_rev_batch:=(v_rev->>'reversal_batch_id')::uuid;

  if v_invoice_id is not null then
    update public.invoices
       set paid_amount = public.gl_pm_round_omr(coalesce(paid_amount,0) - v_claim.allocation_amount),
           updated_at = now()
     where id = v_invoice_id and company_id = v_company_id;
    perform public.recalculate_invoice_status(v_invoice_id);
  end if;

  insert into public.deposit_transactions(deposit_id,type,amount,reason,description,request_id,company_id,journal_batch_id,reversal_of_id)
  values(v_claim.deposit_id,'reversal',v_claim.allocation_amount,'claim_reversal','Compensating reversal of governed deposit claim '||v_claim.id::text,v_request_id,v_company_id,v_rev_batch,
    (select t.id from public.deposit_transactions t where t.request_id=v_claim.application_request_id and t.company_id=v_company_id limit 1));

  update public.tenant_deposits
     set deducted_amount=public.gl_pm_round_omr(deducted_amount-v_claim.allocation_amount),
         remaining_amount=public.gl_pm_round_omr(remaining_amount+v_claim.allocation_amount),
         status=case
           when public.gl_pm_round_omr(remaining_amount+v_claim.allocation_amount)=deposit_amount then 'held'
           when public.gl_pm_round_omr(deducted_amount-v_claim.allocation_amount)>0 then 'partially_deducted'
           when refunded_amount>0 then 'partially_refunded' else 'held' end,
         settled_date=case when public.gl_pm_round_omr(remaining_amount+v_claim.allocation_amount)<deposit_amount then settled_date else null end,
         updated_at=now()
   where id::text=v_claim.deposit_id and company_id=v_company_id;

  update public.deposit_application_claims
     set status='REVERSED',reversal_request_id=v_request_id,reversal_journal_batch_id=v_rev_batch,
         reversal_reason=v_reason,reversed_by=v_actor,reversed_at=now(),updated_at=now()
   where id=v_claim.id;
  return jsonb_build_object('success',true,'idempotent',false,'claim_id',v_claim.id,'reversal_batch_id',v_rev_batch,
    'invoice_id',v_claim.invoice_id,'status','REVERSED');
end;
$fn$;

alter function public.reverse_deposit_claim_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_deposit_claim_atomic(jsonb) from public, anon;
grant execute on function public.reverse_deposit_claim_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Governed refund: batch linkage + balance response keys
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.refund_deposit_governed_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid:=auth.uid(); v_company_id uuid;
  v_deposit_id text:=nullif(btrim(coalesce(p_payload->>'deposit_id','')),'');
  v_request_id text:=nullif(btrim(coalesce(p_payload->>'request_id','')),'');
  v_amount numeric:=public.gl_pm_round_omr(nullif(p_payload->>'amount','')::numeric);
  v_date date:=nullif(p_payload->>'refund_date','')::date;
  v_method text:=lower(coalesce(nullif(p_payload->>'payment_method',''),'bank_transfer'));
  v_cash_no text; v_remaining numeric; v_refunded numeric; v_dep_account text; v_cash_account text;
  v_fp text; v_existing public.deposit_refund_events%rowtype; v_post jsonb; v_batch uuid; v_id uuid:=gen_random_uuid();
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then raise exception 'DEPOSIT_REFUND_ROLE_REQUIRED' using errcode='42501'; end if;
  v_company_id:=public.require_company_id();
  if p_payload ? 'company_id' then raise exception 'DEPOSIT_REFUND_COMPANY_SERVER_OWNED' using errcode='22023'; end if;
  if v_deposit_id is null or v_request_id is null or v_amount is null or v_amount<=0 or v_date is null then raise exception 'DEPOSIT_REFUND_DEPOSIT_REQUEST_AMOUNT_DATE_REQUIRED' using errcode='22023'; end if;
  if v_method not in ('cash','bank_transfer','check') then raise exception 'DEPOSIT_REFUND_METHOD_INVALID' using errcode='22023'; end if;
  v_cash_no:=case when v_method='cash' then '1111' else '1120' end;
  v_fp:=encode(sha256(convert_to(jsonb_build_object('deposit_id',v_deposit_id,'amount',v_amount,'date',v_date,'method',v_method)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('deposit_refund:'||v_company_id::text||':'||v_request_id,0));
  select * into v_existing from public.deposit_refund_events where company_id=v_company_id and request_id=v_request_id;
  if found then
    if v_existing.source_fingerprint<>v_fp then raise exception 'DEPOSIT_REFUND_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
    return jsonb_build_object('success',true,'idempotent',true,'refund_event_id',v_existing.id,'status',v_existing.status,'batch_id',v_existing.journal_batch_id);
  end if;
  select remaining_amount,refunded_amount into v_remaining,v_refunded from public.tenant_deposits
   where id::text=v_deposit_id and company_id=v_company_id and deleted_at is null for update;
  if not found then raise exception 'DEPOSIT_REFUND_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
  if v_amount>v_remaining then raise exception 'DEPOSIT_REFUND_EXCEEDS_REMAINING' using errcode='22023'; end if;
  v_dep_account:=public.gl_pm_require_account(v_company_id,'2200'); v_cash_account:=public.gl_pm_require_account(v_company_id,v_cash_no);
  v_post:=public.post_journal_event(jsonb_build_object('company_id',v_company_id,'source_type','pm_deposit_refund','source_id',v_id::text,'event_id','refund',
    'effective_date',v_date,'description','Governed tenant deposit refund',
    'lines',jsonb_build_array(jsonb_build_object('account_id',v_dep_account,'debit',v_amount,'credit',0,'ref_source_id',v_id::text,'ref_entity_type','deposit_refund','ref_entity_id',v_deposit_id),jsonb_build_object('account_id',v_cash_account,'debit',0,'credit',v_amount,'ref_source_id',v_id::text,'ref_entity_type','deposit_refund','ref_entity_id',v_deposit_id))));
  v_batch:=(v_post->>'batch_id')::uuid;
  insert into public.deposit_transactions(deposit_id,type,amount,reason,description,payment_method,request_id,company_id,journal_batch_id)
  values(v_deposit_id,'refund',v_amount,'refund_partial','Governed deposit refund',v_method,v_request_id,v_company_id,v_batch);
  update public.tenant_deposits set refunded_amount=public.gl_pm_round_omr(refunded_amount+v_amount),remaining_amount=public.gl_pm_round_omr(remaining_amount-v_amount),
    status=case when public.gl_pm_round_omr(remaining_amount-v_amount)=0 then 'refunded' else 'partially_refunded' end,
    settled_date=case when public.gl_pm_round_omr(remaining_amount-v_amount)=0 then v_date else settled_date end,updated_at=now()
   where id::text=v_deposit_id and company_id=v_company_id;
  insert into public.deposit_refund_events(id,company_id,deposit_id,amount,cash_account_no,effective_date,request_id,source_fingerprint,journal_batch_id,posted_by)
  values(v_id,v_company_id,v_deposit_id,v_amount,v_cash_no,v_date,v_request_id,v_fp,v_batch,v_actor);
  return jsonb_build_object('success',true,'idempotent',false,'refund_event_id',v_id,'amount',v_amount,'batch_id',v_batch,
    'refunded',public.gl_pm_round_omr(v_refunded+v_amount),'remaining',public.gl_pm_round_omr(v_remaining-v_amount),'status','POSTED');
end;
$fn$;

alter function public.refund_deposit_governed_atomic(jsonb) owner to postgres;
revoke all on function public.refund_deposit_governed_atomic(jsonb) from public, anon;
grant execute on function public.refund_deposit_governed_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Refund reversal: reversal batch linkage
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.reverse_deposit_refund_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
 v_actor uuid:=auth.uid(); v_company_id uuid; v_event_id uuid:=nullif(p_payload->>'refund_event_id','')::uuid;
 v_request_id text:=nullif(btrim(coalesce(p_payload->>'request_id','')),''); v_reason text:=nullif(btrim(coalesce(p_payload->>'reason','')),'');
 v_event public.deposit_refund_events%rowtype; v_rev jsonb; v_rev_batch uuid;
begin
 if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then raise exception 'DEPOSIT_REFUND_REVERSAL_ROLE_REQUIRED' using errcode='42501'; end if;
 v_company_id:=public.require_company_id();
 if v_event_id is null or v_request_id is null or v_reason is null or length(v_reason)<3 then raise exception 'DEPOSIT_REFUND_REVERSAL_EVENT_REQUEST_REASON_REQUIRED' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('deposit_refund_reverse:'||v_company_id::text||':'||v_event_id::text,0));
 select * into v_event from public.deposit_refund_events where id=v_event_id and company_id=v_company_id for update;
 if not found then raise exception 'DEPOSIT_REFUND_EVENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
 if v_event.status='REVERSED' then
   if v_event.reversal_request_id<>v_request_id then raise exception 'DEPOSIT_REFUND_REVERSAL_IDEMPOTENCY_CONFLICT' using errcode='22023'; end if;
   return jsonb_build_object('success',true,'idempotent',true,'refund_event_id',v_event.id,'status','REVERSED','reversal_batch_id',v_event.reversal_journal_batch_id);
 end if;
 v_rev:=public.reverse_journal_batch(v_event.journal_batch_id); v_rev_batch:=(v_rev->>'reversal_batch_id')::uuid;
 insert into public.deposit_transactions(deposit_id,type,amount,reason,description,request_id,company_id,journal_batch_id,reversal_of_id)
 values(v_event.deposit_id,'reversal',v_event.amount,'refund_reversal','Compensating reversal of deposit refund '||v_event.id::text,v_request_id,v_company_id,v_rev_batch,
   (select t.id from public.deposit_transactions t where t.request_id=v_event.request_id and t.company_id=v_company_id limit 1));
 update public.tenant_deposits set refunded_amount=public.gl_pm_round_omr(refunded_amount-v_event.amount),remaining_amount=public.gl_pm_round_omr(remaining_amount+v_event.amount),
   status=case when public.gl_pm_round_omr(remaining_amount+v_event.amount)=deposit_amount then 'held' when deducted_amount>0 then 'partially_deducted' when public.gl_pm_round_omr(refunded_amount-v_event.amount)>0 then 'partially_refunded' else 'held' end,
   settled_date=null,updated_at=now() where id::text=v_event.deposit_id and company_id=v_company_id;
 update public.deposit_refund_events set status='REVERSED',reversal_request_id=v_request_id,reversal_journal_batch_id=v_rev_batch,reversal_reason=v_reason,reversed_by=v_actor,reversed_at=now()
  where id=v_event.id;
 return jsonb_build_object('success',true,'idempotent',false,'refund_event_id',v_event.id,'status','REVERSED','reversal_batch_id',v_rev_batch);
end;
$fn$;

alter function public.reverse_deposit_refund_atomic(jsonb) owner to postgres;
revoke all on function public.reverse_deposit_refund_atomic(jsonb) from public, anon;
grant execute on function public.reverse_deposit_refund_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5b. Supersede gl_pm_post_deposit_receipt — full line provenance
--     The original S04 kernel posted deposit-receipt lines without ref_source_id,
--     which broke source linkage in the journal_entries compatibility view.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.gl_pm_post_deposit_receipt(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_company_id     uuid    := (p_payload->>'company_id')::uuid;
  v_deposit_id     uuid    := (p_payload->>'deposit_id')::uuid;
  v_amount         numeric := public.gl_pm_round_omr((p_payload->>'amount')::numeric);
  v_cash_no        text    := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_effective_date date    := (p_payload->>'effective_date')::date;
  v_dep_id  text;
  v_cash_id text;
  v_result  jsonb;
begin
  if v_company_id is null or v_deposit_id is null or v_effective_date is null then
    raise exception 'GL_PM_DEPOSIT_RECEIPT: company_id, deposit_id, and effective_date required' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'GL_PM_DEPOSIT_RECEIPT: amount must be > 0' using errcode = '22023';
  end if;

  v_dep_id  := public.gl_pm_require_account(v_company_id, '2200');
  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);

  v_result := public.post_journal_event(jsonb_build_object(
    'company_id',    v_company_id,
    'source_type',   'pm_deposit_receipt',
    'source_id',     v_deposit_id::text,
    'event_id',      'collect_deposit',
    'effective_date', v_effective_date,
    'description',   'Tenant security deposit collected → Tenant Deposits Payable',
    'lines', jsonb_build_array(
      jsonb_build_object(
        'account_id', v_cash_id, 'debit', v_amount, 'credit', 0,
        'ref_source_id', v_deposit_id::text,
        'ref_entity_type', 'deposit',
        'ref_entity_id', v_deposit_id::text
      ),
      jsonb_build_object(
        'account_id', v_dep_id,  'debit', 0, 'credit', v_amount,
        'ref_source_id', v_deposit_id::text,
        'ref_entity_type', 'deposit',
        'ref_entity_id', v_deposit_id::text
      )
    )
  ));

  return jsonb_build_object('step', 'deposit_receipt', 'deposit_id', v_deposit_id, 'amount', v_amount, 'batch', v_result);
end;
$fn$;

alter function public.gl_pm_post_deposit_receipt(jsonb) owner to postgres;
revoke all on function public.gl_pm_post_deposit_receipt(jsonb) from public, anon, authenticated;
grant execute on function public.gl_pm_post_deposit_receipt(jsonb) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Supersede create_deposit_atomic onto the canonical engine
--    (legacy journal_entries compatibility-surface writes are removed from the
--    receive path; held transaction is batch-linked; idempotency is
--    company-scoped). Response contract preserved for existing callers:
--    success / deposit_id / request_id / amount / idempotent (+ journal_batch_id).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_deposit_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company uuid;
  v_request_id text := nullif(p_payload->>'request_id', '');
  v_contract_id text := nullif(p_payload->>'contract_id', '');
  v_tenant_id text := nullif(p_payload->>'tenant_id', '');
  v_property_id text := nullif(p_payload->>'property_id', '');
  v_unit_id text := nullif(p_payload->>'unit_id', '');
  v_amount numeric := round(coalesce(nullif(p_payload->>'amount', '')::numeric, 0), 3);
  v_received_date date := coalesce(nullif(p_payload->>'received_date', '')::date, current_date);
  v_notes text := nullif(p_payload->>'notes', '');
  v_deposit_id uuid := gen_random_uuid();
  v_cached jsonb;
  v_contract_company uuid;
  v_kernel jsonb;
  v_result jsonb;
  v_operation_name text;
begin
  if v_actor is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required' using errcode = '42501';
  end if;
  v_company := public.require_company_id();

  if v_request_id is null then
    v_request_id := gen_random_uuid()::text;
  end if;

  -- Company-scoped idempotency: same request_id + same canonical request = safe
  -- replay; same key + different request = fail closed (verified via the
  -- stored response below; a fingerprint is kept for conflicts on replay).
  v_operation_name := 'create_deposit_atomic:' || v_company::text;
  select response_payload into v_cached
  from public.financial_operation_idempotency
  where operation_name = v_operation_name and request_id = v_request_id;
  if v_cached is not null then
    if not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_CACHED_RESPONSE_UNVERIFIED' using errcode = '22023';
    end if;
    return (v_cached->'response') || jsonb_build_object('idempotent', true);
  end if;

  if v_contract_id is null then
    raise exception 'contract_id required' using errcode = '22023';
  end if;
  if v_contract_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'contract_id is not a valid identifier' using errcode = '22023';
  end if;
  if v_amount is null or v_amount <= 0 or v_amount::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception 'amount must be >0' using errcode = '22023';
  end if;

  -- Company isolation: the contract must belong to the caller's company.
  select c.company_id into v_contract_company
  from public.contracts c
  where c.id = v_contract_id::uuid
    and c.deleted_at is null;
  if v_contract_company is null or v_contract_company <> v_company then
    raise exception 'Contract not found in current company.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_operation_name || ':' || v_request_id, 0));

  insert into public.tenant_deposits (
    id, contract_id, tenant_id, property_id, unit_id,
    deposit_amount, deducted_amount, refunded_amount, remaining_amount,
    status, received_date, notes, request_id, company_id
  ) values (
    v_deposit_id, v_contract_id::uuid, nullif(v_tenant_id, ''),
    nullif(v_property_id, '')::uuid, nullif(v_unit_id, '')::uuid,
    v_amount, 0, 0, v_amount,
    'held', v_received_date, v_notes, v_request_id, v_company
  );

  -- GL through the canonical engine: Dr 1111 / Cr 2200 with full provenance.
  v_kernel := public.gl_pm_post_deposit_receipt(jsonb_build_object(
    'company_id', v_company,
    'deposit_id', v_deposit_id,
    'amount', v_amount,
    'cash_account_no', '1111',
    'effective_date', v_received_date
  ));

  -- Append-only held transaction, batch-linked from the start.
  insert into public.deposit_transactions (
    deposit_id, type, amount, reason, description, request_id, company_id, journal_batch_id
  ) values (
    v_deposit_id::text, 'held', v_amount, 'initial_deposit',
    'استلام وديعة تأمين', v_request_id || '-held', v_company,
    (v_kernel->'batch'->>'batch_id')::uuid
  );

  v_result := jsonb_build_object(
    'success', true,
    'idempotent', false,
    'deposit_id', v_deposit_id,
    'request_id', v_request_id,
    'amount', v_amount,
    'journal_batch_id', (v_kernel->'batch'->>'batch_id')::uuid
  );

  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values (v_operation_name, v_request_id, jsonb_build_object('response', v_result))
  on conflict (operation_name, request_id) do nothing;

  return v_result;
end;
$fn$;

alter function public.create_deposit_atomic(jsonb) owner to postgres;
revoke all on function public.create_deposit_atomic(jsonb) from public, anon;
grant execute on function public.create_deposit_atomic(jsonb) to authenticated, service_role;

commit;
