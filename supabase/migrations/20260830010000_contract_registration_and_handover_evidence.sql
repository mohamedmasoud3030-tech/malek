-- PRODUCT Evidence & Compliance Journey / OPS-004, OPS-006, DOM-010.
-- Additive, company-isolated and fail-closed. This migration does NOT assert
-- any Omani authority, fee, deadline or legal wording. Registration actions
-- remain disabled until an approved effective company profile is installed.

begin;

create table if not exists public.contract_registration_requirement_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  jurisdiction_code text not null check (length(btrim(jurisdiction_code)) between 2 and 50),
  authority_name text not null check (length(btrim(authority_name)) between 2 and 200),
  registration_required boolean not null,
  deadline_days integer check (deadline_days is null or deadline_days between 0 and 3650),
  fee_mode text not null default 'UNCONFIGURED' check (fee_mode in ('UNCONFIGURED','FIXED','PERCENTAGE','EXTERNAL')),
  fee_value numeric(18,6) check (fee_value is null or fee_value >= 0),
  currency text check (currency is null or length(btrim(currency)) between 3 and 8),
  legal_reference text not null check (length(btrim(legal_reference)) between 3 and 1000),
  effective_from date not null,
  effective_to date,
  approved_by_label text not null check (length(btrim(approved_by_label)) between 2 and 200),
  approved_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint contract_registration_profile_date_chk check (effective_to is null or effective_to >= effective_from),
  constraint contract_registration_profile_fee_chk check (
    (fee_mode in ('UNCONFIGURED','EXTERNAL') and fee_value is null)
    or (fee_mode in ('FIXED','PERCENTAGE') and fee_value is not null)
  ),
  unique(company_id, jurisdiction_code, effective_from)
);

create index if not exists contract_registration_profiles_effective_idx
  on public.contract_registration_requirement_profiles(company_id, effective_from desc, effective_to);

create table if not exists public.contract_registration_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  requirement_profile_id uuid not null references public.contract_registration_requirement_profiles(id) on delete restrict,
  jurisdiction_code_snapshot text not null,
  authority_name_snapshot text not null,
  legal_reference_snapshot text not null,
  deadline_days_snapshot integer,
  fee_mode_snapshot text not null,
  fee_value_snapshot numeric(18,6),
  currency_snapshot text,
  status text not null check (status in ('SUBMITTED','REGISTERED','REJECTED','CANCELLED')),
  submitted_on date not null,
  external_request_reference text,
  registration_reference text,
  registered_on date,
  expires_on date,
  fee_paid numeric(18,3) check (fee_paid is null or fee_paid >= 0),
  evidence_document_id uuid,
  decision_reason text,
  submission_request_id text not null,
  decision_request_id text,
  submitted_by uuid not null,
  decided_by uuid,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contract_registration_submission_request_uq unique(company_id, submission_request_id),
  constraint contract_registration_decision_request_uq unique(company_id, decision_request_id),
  constraint contract_registration_registered_shape_chk check (
    status <> 'REGISTERED'
    or (
      nullif(btrim(registration_reference),'') is not null
      and registered_on is not null
      and evidence_document_id is not null
      and decided_by is not null
      and decided_at is not null
    )
  ),
  constraint contract_registration_rejected_shape_chk check (
    status <> 'REJECTED'
    or (nullif(btrim(decision_reason),'') is not null and decided_by is not null and decided_at is not null)
  )
);

create unique index if not exists contract_registration_one_open_idx
  on public.contract_registration_records(company_id, contract_id)
  where status in ('SUBMITTED','REGISTERED');
create index if not exists contract_registration_contract_idx
  on public.contract_registration_records(company_id, contract_id, created_at desc);

create table if not exists public.contract_inspection_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete restrict,
  code text not null,
  kind text not null check (kind in ('MOVE_IN','MOVE_OUT')),
  title_ar text not null,
  version_no integer not null check (version_no > 0),
  checklist_definition jsonb not null check (jsonb_typeof(checklist_definition) = 'array'),
  is_system_default boolean not null default false,
  active boolean not null default true,
  effective_from date not null,
  effective_to date,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint contract_inspection_template_date_chk check (effective_to is null or effective_to >= effective_from),
  unique(company_id, code, version_no)
);

create unique index if not exists contract_inspection_system_template_uq
  on public.contract_inspection_templates(code, version_no)
  where company_id is null;

insert into public.contract_inspection_templates (
  company_id, code, kind, title_ar, version_no, checklist_definition,
  is_system_default, effective_from
) values
  (null, 'SYSTEM_MOVE_IN', 'MOVE_IN', 'فحص وتسليم الوحدة عند الدخول', 1,
   '[{"code":"general_condition","label_ar":"الحالة العامة","required":true},{"code":"walls_ceiling","label_ar":"الجدران والأسقف","required":true},{"code":"floors","label_ar":"الأرضيات","required":true},{"code":"doors_windows_locks","label_ar":"الأبواب والنوافذ والأقفال","required":true},{"code":"plumbing","label_ar":"السباكة والمياه","required":true},{"code":"electrical","label_ar":"الكهرباء والإنارة","required":true},{"code":"fixtures_appliances","label_ar":"التجهيزات والأجهزة المثبتة","required":false},{"code":"cleanliness","label_ar":"النظافة","required":true},{"code":"meters","label_ar":"قراءات العدادات","required":true},{"code":"keys_access","label_ar":"المفاتيح ووسائل الدخول","required":true}]'::jsonb,
   true, date '2026-01-01'),
  (null, 'SYSTEM_MOVE_OUT', 'MOVE_OUT', 'فحص واستلام الوحدة عند الإخلاء', 1,
   '[{"code":"general_condition","label_ar":"الحالة العامة","required":true},{"code":"walls_ceiling","label_ar":"الجدران والأسقف","required":true},{"code":"floors","label_ar":"الأرضيات","required":true},{"code":"doors_windows_locks","label_ar":"الأبواب والنوافذ والأقفال","required":true},{"code":"plumbing","label_ar":"السباكة والمياه","required":true},{"code":"electrical","label_ar":"الكهرباء والإنارة","required":true},{"code":"fixtures_appliances","label_ar":"التجهيزات والأجهزة المثبتة","required":false},{"code":"cleanliness","label_ar":"النظافة","required":true},{"code":"meters","label_ar":"قراءات العدادات النهائية","required":true},{"code":"keys_access","label_ar":"المفاتيح ووسائل الدخول المستلمة","required":true}]'::jsonb,
   true, date '2026-01-01')
on conflict do nothing;

create table if not exists public.contract_inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  template_id uuid not null references public.contract_inspection_templates(id) on delete restrict,
  template_snapshot jsonb not null,
  kind text not null check (kind in ('MOVE_IN','MOVE_OUT')),
  status text not null default 'DRAFT' check (status in ('DRAFT','COMPLETED','REVIEWED','CHANGES_REQUESTED')),
  inspected_on date not null,
  checklist jsonb not null check (jsonb_typeof(checklist) = 'array'),
  meter_readings jsonb not null default '{}'::jsonb check (jsonb_typeof(meter_readings) = 'object'),
  keys_and_access jsonb not null default '{}'::jsonb check (jsonb_typeof(keys_and_access) = 'object'),
  summary text,
  evidence_document_ids uuid[] not null default '{}'::uuid[],
  tenant_signature text,
  office_signature text,
  completion_request_id text,
  review_request_id text,
  review_reason text,
  created_by uuid not null,
  completed_by uuid,
  reviewed_by uuid,
  completed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  request_id text not null,
  constraint contract_inspection_request_uq unique(company_id, request_id),
  constraint contract_inspection_completion_request_uq unique(company_id, completion_request_id),
  constraint contract_inspection_review_request_uq unique(company_id, review_request_id),
  constraint contract_inspection_completion_shape_chk check (
    status = 'DRAFT'
    or (
      nullif(btrim(tenant_signature),'') is not null
      and nullif(btrim(office_signature),'') is not null
      and completed_by is not null
      and completed_at is not null
      and completion_request_id is not null
    )
  ),
  constraint contract_inspection_review_shape_chk check (
    status not in ('REVIEWED','CHANGES_REQUESTED')
    or (reviewed_by is not null and reviewed_at is not null and review_request_id is not null)
  ),
  constraint contract_inspection_changes_shape_chk check (
    status <> 'CHANGES_REQUESTED' or nullif(btrim(review_reason),'') is not null
  )
);

create unique index if not exists contract_inspection_one_current_kind_idx
  on public.contract_inspections(company_id, contract_id, kind)
  where status in ('DRAFT','COMPLETED','REVIEWED');
create index if not exists contract_inspection_contract_idx
  on public.contract_inspections(company_id, contract_id, inspected_on desc);

do $optional_deposit_link$
begin
  if to_regclass('public.deposit_application_claims') is not null then
    alter table public.deposit_application_claims
      add column if not exists inspection_id uuid references public.contract_inspections(id) on delete restrict;
    create index if not exists deposit_application_claims_inspection_idx
      on public.deposit_application_claims(company_id, inspection_id)
      where inspection_id is not null;
  end if;
end;
$optional_deposit_link$;

create table if not exists public.contract_evidence_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  contract_id uuid not null references public.contracts(id) on delete restrict,
  entity_type text not null check (entity_type in ('REGISTRATION','INSPECTION')),
  entity_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text not null,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists contract_evidence_events_contract_idx
  on public.contract_evidence_events(company_id, contract_id, created_at desc);

alter table public.contract_registration_requirement_profiles enable row level security;
alter table public.contract_registration_records enable row level security;
alter table public.contract_inspection_templates enable row level security;
alter table public.contract_inspections enable row level security;
alter table public.contract_evidence_events enable row level security;

drop policy if exists contract_registration_profiles_read on public.contract_registration_requirement_profiles;
create policy contract_registration_profiles_read on public.contract_registration_requirement_profiles
  for select to authenticated using (company_id = public.current_company_id());
drop policy if exists contract_registration_records_read on public.contract_registration_records;
create policy contract_registration_records_read on public.contract_registration_records
  for select to authenticated using (company_id = public.current_company_id());
drop policy if exists contract_inspection_templates_read on public.contract_inspection_templates;
create policy contract_inspection_templates_read on public.contract_inspection_templates
  for select to authenticated using (company_id is null or company_id = public.current_company_id());
drop policy if exists contract_inspections_read on public.contract_inspections;
create policy contract_inspections_read on public.contract_inspections
  for select to authenticated using (company_id = public.current_company_id());
drop policy if exists contract_evidence_events_read on public.contract_evidence_events;
create policy contract_evidence_events_read on public.contract_evidence_events
  for select to authenticated using (company_id = public.current_company_id());

revoke all on public.contract_registration_requirement_profiles, public.contract_registration_records,
  public.contract_inspection_templates, public.contract_inspections, public.contract_evidence_events
  from public, anon, authenticated;
grant select on public.contract_registration_requirement_profiles, public.contract_registration_records,
  public.contract_inspection_templates, public.contract_inspections, public.contract_evidence_events
  to authenticated;
grant select, insert, update, delete on public.contract_registration_requirement_profiles,
  public.contract_registration_records, public.contract_inspection_templates,
  public.contract_inspections, public.contract_evidence_events to service_role;

create or replace function public.contract_evidence_actor_can_operate()
returns boolean language sql stable security definer set search_path to 'public','pg_temp'
as $$ select public.current_app_role() in ('ADMIN','MANAGER','OPERATIONS') $$;

create or replace function public.contract_evidence_actor_can_verify()
returns boolean language sql stable security definer set search_path to 'public','pg_temp'
as $$ select public.current_app_role() in ('ADMIN','MANAGER') $$;

revoke all on function public.contract_evidence_actor_can_operate() from public, anon;
revoke all on function public.contract_evidence_actor_can_verify() from public, anon;
grant execute on function public.contract_evidence_actor_can_operate(), public.contract_evidence_actor_can_verify() to authenticated, service_role;

create or replace function public.contract_evidence_assert_documents(
  p_company uuid, p_contract uuid, p_document_ids uuid[]
) returns void language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_id uuid;
begin
  foreach v_id in array coalesce(p_document_ids, '{}'::uuid[]) loop
    if not exists (
      select 1 from public.vault_documents d
      where d.id = v_id and d.company_id = p_company and d.deleted_at is null
        and d.related_entity_type = 'contract' and d.related_entity_id = p_contract::text
    ) then
      raise exception 'CONTRACT_EVIDENCE_DOCUMENT_INVALID' using errcode = '23514';
    end if;
  end loop;
end;
$function$;
revoke all on function public.contract_evidence_assert_documents(uuid,uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.contract_evidence_assert_documents(uuid,uuid,uuid[]) to service_role;

create or replace function public.get_contract_evidence_state(p_contract_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_company uuid := public.require_company_id();
  v_contract public.contracts%rowtype;
  v_profile jsonb;
  v_registration jsonb;
  v_inspections jsonb;
  v_templates jsonb;
begin
  select * into v_contract from public.contracts c
  where c.id = p_contract_id and c.company_id = v_company and c.deleted_at is null;
  if not found then raise exception 'CONTRACT_NOT_FOUND' using errcode = '42501'; end if;

  select to_jsonb(p) into v_profile
  from public.contract_registration_requirement_profiles p
  where p.company_id = v_company and p.effective_from <= v_contract.start_date
    and (p.effective_to is null or p.effective_to >= v_contract.start_date)
  order by p.effective_from desc limit 1;

  select to_jsonb(r) into v_registration
  from public.contract_registration_records r
  where r.company_id = v_company and r.contract_id = p_contract_id
  order by r.created_at desc limit 1;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.inspected_on desc, i.created_at desc), '[]'::jsonb)
    into v_inspections from public.contract_inspections i
  where i.company_id = v_company and i.contract_id = p_contract_id;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.kind, t.version_no desc), '[]'::jsonb)
    into v_templates from public.contract_inspection_templates t
  where t.active and (t.company_id = v_company or t.company_id is null)
    and t.effective_from <= current_date and (t.effective_to is null or t.effective_to >= current_date);

  return jsonb_build_object(
    'registration_configuration_status', case when v_profile is null then 'NOT_CONFIGURED' else 'CONFIGURED' end,
    'registration_profile', v_profile,
    'registration', v_registration,
    'inspections', v_inspections,
    'inspection_templates', v_templates
  );
end;
$function$;
revoke all on function public.get_contract_evidence_state(uuid) from public, anon;
grant execute on function public.get_contract_evidence_state(uuid) to authenticated, service_role;

create or replace function public.submit_contract_registration_atomic(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_actor uuid := auth.uid(); v_company uuid := public.require_company_id();
  v_contract public.contracts%rowtype; v_profile public.contract_registration_requirement_profiles%rowtype;
  v_existing public.contract_registration_records%rowtype; v_record public.contract_registration_records%rowtype;
  v_contract_id uuid := nullif(p_payload->>'contract_id','')::uuid;
  v_request text := nullif(btrim(p_payload->>'request_id'),'');
  v_doc uuid := nullif(p_payload->>'evidence_document_id','')::uuid;
begin
  if v_actor is null or not public.contract_evidence_actor_can_operate() then raise exception 'CONTRACT_EVIDENCE_FORBIDDEN' using errcode='42501'; end if;
  if v_request is null or v_contract_id is null then raise exception 'CONTRACT_REGISTRATION_INPUT_REQUIRED' using errcode='22023'; end if;
  select * into v_existing from public.contract_registration_records where company_id=v_company and submission_request_id=v_request;
  if found then return to_jsonb(v_existing); end if;
  select * into v_contract from public.contracts where id=v_contract_id and company_id=v_company and deleted_at is null;
  if not found then raise exception 'CONTRACT_NOT_FOUND' using errcode='42501'; end if;
  select * into v_profile from public.contract_registration_requirement_profiles p
   where p.company_id=v_company and p.effective_from<=v_contract.start_date
     and (p.effective_to is null or p.effective_to>=v_contract.start_date)
   order by p.effective_from desc limit 1;
  if not found then raise exception 'CONTRACT_REGISTRATION_NOT_CONFIGURED' using errcode='55000'; end if;
  if not v_profile.registration_required then raise exception 'CONTRACT_REGISTRATION_NOT_REQUIRED' using errcode='22023'; end if;
  if v_doc is not null then perform public.contract_evidence_assert_documents(v_company,v_contract_id,array[v_doc]); end if;
  if exists(select 1 from public.contract_registration_records where company_id=v_company and contract_id=v_contract_id and status in ('SUBMITTED','REGISTERED')) then
    raise exception 'CONTRACT_REGISTRATION_ALREADY_OPEN' using errcode='23505';
  end if;
  insert into public.contract_registration_records(
    company_id,contract_id,requirement_profile_id,jurisdiction_code_snapshot,authority_name_snapshot,
    legal_reference_snapshot,deadline_days_snapshot,fee_mode_snapshot,fee_value_snapshot,currency_snapshot,
    status,submitted_on,external_request_reference,evidence_document_id,submission_request_id,submitted_by
  ) values (
    v_company,v_contract_id,v_profile.id,v_profile.jurisdiction_code,v_profile.authority_name,
    v_profile.legal_reference,v_profile.deadline_days,v_profile.fee_mode,v_profile.fee_value,v_profile.currency,
    'SUBMITTED',coalesce(nullif(p_payload->>'submitted_on','')::date,current_date),nullif(btrim(p_payload->>'external_request_reference'),''),
    v_doc,v_request,v_actor
  ) returning * into v_record;
  insert into public.contract_evidence_events(company_id,contract_id,entity_type,entity_id,event_type,to_status,payload,actor_id)
    values(v_company,v_contract_id,'REGISTRATION',v_record.id,'SUBMITTED','SUBMITTED',jsonb_build_object('request_id',v_request),v_actor);
  return to_jsonb(v_record);
end;
$function$;
revoke all on function public.submit_contract_registration_atomic(jsonb) from public, anon;
grant execute on function public.submit_contract_registration_atomic(jsonb) to authenticated, service_role;

create or replace function public.decide_contract_registration_atomic(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid(); v_company uuid:=public.require_company_id();
  v_record public.contract_registration_records%rowtype; v_action text:=upper(p_payload->>'action');
  v_request text:=nullif(btrim(p_payload->>'request_id'),''); v_doc uuid:=nullif(p_payload->>'evidence_document_id','')::uuid;
  v_old text;
begin
  if v_actor is null or not public.contract_evidence_actor_can_verify() then raise exception 'CONTRACT_EVIDENCE_VERIFY_FORBIDDEN' using errcode='42501'; end if;
  select * into v_record from public.contract_registration_records
   where id=nullif(p_payload->>'registration_id','')::uuid and company_id=v_company for update;
  if not found then raise exception 'CONTRACT_REGISTRATION_NOT_FOUND' using errcode='42501'; end if;
  if v_record.decision_request_id=v_request then return to_jsonb(v_record); end if;
  if v_record.status<>'SUBMITTED' or v_request is null then raise exception 'CONTRACT_REGISTRATION_NOT_DECIDABLE' using errcode='22023'; end if;
  if v_record.submitted_by=v_actor then raise exception 'CONTRACT_REGISTRATION_SELF_VERIFICATION_FORBIDDEN' using errcode='42501'; end if;
  v_old:=v_record.status;
  if v_action='REGISTER' then
    if nullif(btrim(p_payload->>'registration_reference'),'') is null or nullif(p_payload->>'registered_on','') is null or v_doc is null then
      raise exception 'CONTRACT_REGISTRATION_EVIDENCE_REQUIRED' using errcode='22023';
    end if;
    perform public.contract_evidence_assert_documents(v_company,v_record.contract_id,array[v_doc]);
    update public.contract_registration_records set status='REGISTERED',registration_reference=btrim(p_payload->>'registration_reference'),
      registered_on=(p_payload->>'registered_on')::date,expires_on=nullif(p_payload->>'expires_on','')::date,
      fee_paid=nullif(p_payload->>'fee_paid','')::numeric,evidence_document_id=v_doc,decision_request_id=v_request,
      decided_by=v_actor,decided_at=now(),updated_at=now() where id=v_record.id returning * into v_record;
  elsif v_action='REJECT' then
    if nullif(btrim(p_payload->>'reason'),'') is null then raise exception 'CONTRACT_REGISTRATION_REJECTION_REASON_REQUIRED' using errcode='22023'; end if;
    update public.contract_registration_records set status='REJECTED',decision_reason=btrim(p_payload->>'reason'),
      decision_request_id=v_request,decided_by=v_actor,decided_at=now(),updated_at=now()
      where id=v_record.id returning * into v_record;
  else raise exception 'CONTRACT_REGISTRATION_ACTION_INVALID' using errcode='22023'; end if;
  insert into public.contract_evidence_events(company_id,contract_id,entity_type,entity_id,event_type,from_status,to_status,reason,payload,actor_id)
    values(v_company,v_record.contract_id,'REGISTRATION',v_record.id,v_action,v_old,v_record.status,v_record.decision_reason,jsonb_build_object('request_id',v_request),v_actor);
  return to_jsonb(v_record);
end;
$function$;
revoke all on function public.decide_contract_registration_atomic(jsonb) from public, anon;
grant execute on function public.decide_contract_registration_atomic(jsonb) to authenticated, service_role;

create or replace function public.contract_inspection_validate_checklist(p_template jsonb,p_checklist jsonb,p_require_complete boolean)
returns void language plpgsql immutable set search_path to 'public','pg_temp'
as $function$
declare v_item jsonb; v_code text; v_condition text;
begin
  if jsonb_typeof(p_checklist)<>'array' then raise exception 'INSPECTION_CHECKLIST_INVALID' using errcode='22023'; end if;
  for v_item in select value from jsonb_array_elements(p_checklist) loop
    v_code:=nullif(v_item->>'code',''); v_condition:=nullif(v_item->>'condition','');
    if v_code is null or not exists(select 1 from jsonb_array_elements(p_template) t where t->>'code'=v_code) then
      raise exception 'INSPECTION_CHECKLIST_ITEM_INVALID' using errcode='22023';
    end if;
    if v_condition is not null and v_condition not in ('GOOD','FAIR','DAMAGED','NOT_APPLICABLE') then
      raise exception 'INSPECTION_CONDITION_INVALID' using errcode='22023';
    end if;
  end loop;
  if p_require_complete and exists(
    select 1 from jsonb_array_elements(p_template) t
    where coalesce((t->>'required')::boolean,false)
      and not exists(select 1 from jsonb_array_elements(p_checklist) c where c->>'code'=t->>'code' and nullif(c->>'condition','') is not null)
  ) then raise exception 'INSPECTION_REQUIRED_ITEMS_INCOMPLETE' using errcode='22023'; end if;
end;
$function$;
revoke all on function public.contract_inspection_validate_checklist(jsonb,jsonb,boolean) from public, anon, authenticated;
grant execute on function public.contract_inspection_validate_checklist(jsonb,jsonb,boolean) to service_role;

create or replace function public.save_contract_inspection_draft_atomic(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid(); v_company uuid:=public.require_company_id(); v_contract public.contracts%rowtype;
  v_template public.contract_inspection_templates%rowtype; v_record public.contract_inspections%rowtype;
  v_id uuid:=nullif(p_payload->>'inspection_id','')::uuid; v_contract_id uuid:=nullif(p_payload->>'contract_id','')::uuid;
  v_kind text:=upper(p_payload->>'kind'); v_request text:=nullif(btrim(p_payload->>'request_id'),'');
  v_checklist jsonb:=coalesce(p_payload->'checklist','[]'::jsonb); v_docs uuid[];
begin
  if v_actor is null or not public.contract_evidence_actor_can_operate() then raise exception 'CONTRACT_EVIDENCE_FORBIDDEN' using errcode='42501'; end if;
  if v_request is null or v_contract_id is null or v_kind not in ('MOVE_IN','MOVE_OUT') then raise exception 'INSPECTION_INPUT_REQUIRED' using errcode='22023'; end if;
  select * into v_record from public.contract_inspections where company_id=v_company and request_id=v_request;
  if found then return to_jsonb(v_record); end if;
  select * into v_contract from public.contracts where id=v_contract_id and company_id=v_company and deleted_at is null;
  if not found then raise exception 'CONTRACT_NOT_FOUND' using errcode='42501'; end if;
  select * into v_template from public.contract_inspection_templates t where t.id=nullif(p_payload->>'template_id','')::uuid
    and t.active and (t.company_id=v_company or t.company_id is null);
  if not found or v_template.kind<>v_kind then raise exception 'INSPECTION_TEMPLATE_INVALID' using errcode='22023'; end if;
  perform public.contract_inspection_validate_checklist(v_template.checklist_definition,v_checklist,false);
  select coalesce(array_agg(value::text::uuid),'{}'::uuid[]) into v_docs from jsonb_array_elements_text(coalesce(p_payload->'evidence_document_ids','[]'::jsonb));
  perform public.contract_evidence_assert_documents(v_company,v_contract_id,v_docs);
  if v_id is null then
    if exists(select 1 from public.contract_inspections where company_id=v_company and contract_id=v_contract_id and kind=v_kind and status in ('DRAFT','COMPLETED','REVIEWED')) then
      raise exception 'INSPECTION_CURRENT_ALREADY_EXISTS' using errcode='23505';
    end if;
    insert into public.contract_inspections(company_id,contract_id,template_id,template_snapshot,kind,status,inspected_on,checklist,meter_readings,keys_and_access,summary,evidence_document_ids,created_by,request_id)
    values(v_company,v_contract_id,v_template.id,to_jsonb(v_template),v_kind,'DRAFT',coalesce(nullif(p_payload->>'inspected_on','')::date,current_date),v_checklist,
      coalesce(p_payload->'meter_readings','{}'::jsonb),coalesce(p_payload->'keys_and_access','{}'::jsonb),nullif(btrim(p_payload->>'summary'),''),v_docs,v_actor,v_request)
    returning * into v_record;
    insert into public.contract_evidence_events(company_id,contract_id,entity_type,entity_id,event_type,to_status,payload,actor_id)
      values(v_company,v_contract_id,'INSPECTION',v_record.id,'DRAFT_CREATED','DRAFT',jsonb_build_object('kind',v_kind),v_actor);
  else
    select * into v_record from public.contract_inspections where id=v_id and company_id=v_company and contract_id=v_contract_id for update;
    if not found or v_record.status not in ('DRAFT','CHANGES_REQUESTED') then raise exception 'INSPECTION_NOT_EDITABLE' using errcode='22023'; end if;
    update public.contract_inspections set template_id=v_template.id,template_snapshot=to_jsonb(v_template),inspected_on=coalesce(nullif(p_payload->>'inspected_on','')::date,inspected_on),
      checklist=v_checklist,meter_readings=coalesce(p_payload->'meter_readings',meter_readings),keys_and_access=coalesce(p_payload->'keys_and_access',keys_and_access),
      summary=nullif(btrim(p_payload->>'summary'),''),evidence_document_ids=v_docs,status='DRAFT',review_reason=null,reviewed_by=null,reviewed_at=null,review_request_id=null,updated_at=now(),request_id=v_request
      where id=v_id returning * into v_record;
    insert into public.contract_evidence_events(company_id,contract_id,entity_type,entity_id,event_type,from_status,to_status,payload,actor_id)
      values(v_company,v_contract_id,'INSPECTION',v_record.id,'DRAFT_SAVED','DRAFT','DRAFT',jsonb_build_object('kind',v_kind),v_actor);
  end if;
  return to_jsonb(v_record);
end;
$function$;
revoke all on function public.save_contract_inspection_draft_atomic(jsonb) from public, anon;
grant execute on function public.save_contract_inspection_draft_atomic(jsonb) to authenticated, service_role;

create or replace function public.complete_contract_inspection_atomic(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_actor uuid:=auth.uid(); v_company uuid:=public.require_company_id(); v_record public.contract_inspections%rowtype; v_request text:=nullif(btrim(p_payload->>'request_id'),'');
begin
  if v_actor is null or not public.contract_evidence_actor_can_operate() then raise exception 'CONTRACT_EVIDENCE_FORBIDDEN' using errcode='42501'; end if;
  select * into v_record from public.contract_inspections where id=nullif(p_payload->>'inspection_id','')::uuid and company_id=v_company for update;
  if not found then raise exception 'INSPECTION_NOT_FOUND' using errcode='42501'; end if;
  if v_record.completion_request_id=v_request then return to_jsonb(v_record); end if;
  if v_record.status not in ('DRAFT','CHANGES_REQUESTED') or v_request is null then raise exception 'INSPECTION_NOT_COMPLETABLE' using errcode='22023'; end if;
  perform public.contract_inspection_validate_checklist(v_record.template_snapshot->'checklist_definition',v_record.checklist,true);
  if nullif(btrim(p_payload->>'tenant_signature'),'') is null or nullif(btrim(p_payload->>'office_signature'),'') is null then
    raise exception 'INSPECTION_SIGNATURES_REQUIRED' using errcode='22023';
  end if;
  update public.contract_inspections set status='COMPLETED',tenant_signature=btrim(p_payload->>'tenant_signature'),office_signature=btrim(p_payload->>'office_signature'),
    completion_request_id=v_request,completed_by=v_actor,completed_at=now(),updated_at=now() where id=v_record.id returning * into v_record;
  insert into public.contract_evidence_events(company_id,contract_id,entity_type,entity_id,event_type,from_status,to_status,payload,actor_id)
    values(v_company,v_record.contract_id,'INSPECTION',v_record.id,'COMPLETED','DRAFT','COMPLETED',jsonb_build_object('request_id',v_request),v_actor);
  return to_jsonb(v_record);
end;
$function$;
revoke all on function public.complete_contract_inspection_atomic(jsonb) from public, anon;
grant execute on function public.complete_contract_inspection_atomic(jsonb) to authenticated, service_role;

create or replace function public.review_contract_inspection_atomic(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare v_actor uuid:=auth.uid(); v_company uuid:=public.require_company_id(); v_record public.contract_inspections%rowtype; v_action text:=upper(p_payload->>'action'); v_request text:=nullif(btrim(p_payload->>'request_id'),''); v_old text;
begin
  if v_actor is null or not public.contract_evidence_actor_can_verify() then raise exception 'CONTRACT_EVIDENCE_VERIFY_FORBIDDEN' using errcode='42501'; end if;
  select * into v_record from public.contract_inspections where id=nullif(p_payload->>'inspection_id','')::uuid and company_id=v_company for update;
  if not found then raise exception 'INSPECTION_NOT_FOUND' using errcode='42501'; end if;
  if v_record.review_request_id=v_request then return to_jsonb(v_record); end if;
  if v_record.status<>'COMPLETED' or v_request is null then raise exception 'INSPECTION_NOT_REVIEWABLE' using errcode='22023'; end if;
  if v_record.completed_by=v_actor then raise exception 'INSPECTION_SELF_REVIEW_FORBIDDEN' using errcode='42501'; end if;
  v_old:=v_record.status;
  if v_action='APPROVE' then
    update public.contract_inspections set status='REVIEWED',review_request_id=v_request,reviewed_by=v_actor,reviewed_at=now(),review_reason=null,updated_at=now()
      where id=v_record.id returning * into v_record;
  elsif v_action='REQUEST_CHANGES' then
    if nullif(btrim(p_payload->>'reason'),'') is null then raise exception 'INSPECTION_REVIEW_REASON_REQUIRED' using errcode='22023'; end if;
    update public.contract_inspections set status='CHANGES_REQUESTED',review_request_id=v_request,reviewed_by=v_actor,reviewed_at=now(),review_reason=btrim(p_payload->>'reason'),updated_at=now()
      where id=v_record.id returning * into v_record;
  else raise exception 'INSPECTION_REVIEW_ACTION_INVALID' using errcode='22023'; end if;
  insert into public.contract_evidence_events(company_id,contract_id,entity_type,entity_id,event_type,from_status,to_status,reason,payload,actor_id)
    values(v_company,v_record.contract_id,'INSPECTION',v_record.id,v_action,v_old,v_record.status,v_record.review_reason,jsonb_build_object('request_id',v_request),v_actor);
  return to_jsonb(v_record);
end;
$function$;
revoke all on function public.review_contract_inspection_atomic(jsonb) from public, anon;
grant execute on function public.review_contract_inspection_atomic(jsonb) to authenticated, service_role;

create or replace function public.create_deposit_application_claim_with_inspection_atomic(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_company uuid:=public.require_company_id(); v_inspection public.contract_inspections%rowtype;
  v_inspection_id uuid:=nullif(p_payload->>'inspection_id','')::uuid; v_claim_kind text:=p_payload->>'claim_kind';
  v_result jsonb; v_claim_id uuid;
begin
  if v_claim_kind='DAMAGE' then
    if v_inspection_id is null then raise exception 'DAMAGE_CLAIM_REVIEWED_MOVE_OUT_INSPECTION_REQUIRED' using errcode='22023'; end if;
    select * into v_inspection from public.contract_inspections i
      where i.id=v_inspection_id and i.company_id=v_company and i.kind='MOVE_OUT' and i.status='REVIEWED';
    if not found then raise exception 'DAMAGE_CLAIM_INSPECTION_INVALID' using errcode='23514'; end if;
  elsif v_inspection_id is not null then
    raise exception 'INSPECTION_ONLY_ALLOWED_FOR_DAMAGE_CLAIM' using errcode='22023';
  end if;

  execute 'select public.create_deposit_application_claim_atomic($1)' into v_result using p_payload - 'inspection_id';
  v_claim_id:=nullif(v_result->>'claim_id','')::uuid;
  if v_claim_id is null then raise exception 'DEPOSIT_CLAIM_ID_MISSING' using errcode='23514'; end if;
  if v_inspection_id is not null then
    update public.deposit_application_claims c set inspection_id=v_inspection_id
      where c.id=v_claim_id and c.company_id=v_company and c.contract_id=v_inspection.contract_id::text;
    if not found then raise exception 'DAMAGE_CLAIM_CONTRACT_INSPECTION_MISMATCH' using errcode='23514'; end if;
  end if;
  return v_result;
end;
$function$;
revoke all on function public.create_deposit_application_claim_with_inspection_atomic(jsonb) from public, anon;
grant execute on function public.create_deposit_application_claim_with_inspection_atomic(jsonb) to authenticated, service_role;
do $revoke_legacy_claim$
begin
  if to_regprocedure('public.create_deposit_application_claim_atomic(jsonb)') is not null then
    execute 'revoke all on function public.create_deposit_application_claim_atomic(jsonb) from authenticated';
  end if;
end;
$revoke_legacy_claim$;

comment on table public.contract_registration_requirement_profiles is 'Legally approved, effective-dated registration configuration. Empty by default; application must show NOT_CONFIGURED.';
comment on table public.contract_inspections is 'Version-snapshotted move-in/move-out evidence with completion signatures and independent review.';
comment on function public.get_contract_evidence_state(uuid) is 'Company-isolated read model for contract registration and handover evidence.';

commit;
