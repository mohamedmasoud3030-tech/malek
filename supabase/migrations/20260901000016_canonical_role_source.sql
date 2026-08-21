-- Governance V1 — canonical role source: company_members.role.
--
-- Closes the authority-source gap identified in PR review.
--   * The active role inside a company is the row in public.company_members
--     for the current user and the active (JWT-issued) company.
--   * public.users.role is NO LONGER an independent authorization source for
--     runtime authority. It remains a per-user default/legacy field only and
--     may not elevate or demote a company membership.
--   * The JWT carries a server-issued, derived copy for efficient
--     enforcement; it is never an independent authority.
--
-- Recreates every role/helper function that previously read users.role, and
-- removes the direct by-name MANAGER grant in the support capability helper
-- so all support capabilities flow through the governed permission resolver.
--
-- One atomic transaction. Forward-only.

begin;

-- ---------------------------------------------------------------------------
-- Single canonical role resolver.
-- Bypasses RLS (SECURITY DEFINER, owner postgres) so it can be called from
-- within RLS policies without recursion. Returns NULL when there is no active
-- company claim or no active membership; callers decide the default.
-- ---------------------------------------------------------------------------
create or replace function public.active_company_role()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select cm.role
    from public.company_members cm
    join public.companies c on c.id = cm.company_id
   where cm.user_id = auth.uid()
     and cm.company_id = public.current_company_id()
     and cm.is_active
     and c.is_active
   limit 1
$$;

alter function public.active_company_role() owner to postgres;
revoke all on function public.active_company_role() from public, anon;
grant execute on function public.active_company_role() to authenticated, service_role;

comment on function public.active_company_role() is
  'Canonical role source: the active company_members.role for the current user and company. users.role and JWT claims are not authoritative.';

-- ---------------------------------------------------------------------------
-- current_app_role returns the active membership role, defaulting to USER when
-- there is no active membership. It replaces the users.role based version.
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.active_company_role(), 'USER'::text);
$$;

alter function public.current_app_role() owner to postgres;

-- ---------------------------------------------------------------------------
-- Role predicates derive from the canonical membership role, not users.role.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.active_company_role() = 'ADMIN';
$$;
alter function public.is_admin() owner to postgres;

create or replace function public.is_admin_or_manager()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.active_company_role() in ('ADMIN','MANAGER');
$$;
alter function public.is_admin_or_manager() owner to postgres;

create or replace function public.is_accountant()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.active_company_role() = 'ACCOUNTANT';
$$;
alter function public.is_accountant() owner to postgres;

create or replace function public.is_operations()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.active_company_role() = 'OPERATIONS';
$$;
alter function public.is_operations() owner to postgres;

create or replace function public.is_viewer()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.active_company_role() = 'VIEWER';
$$;
alter function public.is_viewer() owner to postgres;

-- app_private mirror used by some RLS policies.
create or replace function app_private.is_admin_or_manager()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_admin_or_manager();
$$;
alter function app_private.is_admin_or_manager() owner to postgres;

-- is_app_user = authenticated AND has an active membership in the active
-- company. This replaces the users-only check so a stale/deactivated user
-- without a membership is not treated as an app user for the company.
create or replace function public.is_app_user()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and public.active_company_role() is not null;
$$;
alter function public.is_app_user() owner to postgres;

-- ---------------------------------------------------------------------------
-- Support capability resolver: no by-name role shortcuts. Every capability is
-- resolved through the governed permission authority.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_has_support_capability(p_capability text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_app_user()
     and public.current_user_has_effective_app_permission(p_capability);
$$;
alter function public.current_user_has_support_capability(text) owner to postgres;
revoke all on function public.current_user_has_support_capability(text) from public, anon;
grant execute on function public.current_user_has_support_capability(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- request_permission recipients are ADMIN reviewers chosen by their active
-- company membership role (the canonical source), not users.role.
-- ---------------------------------------------------------------------------
create or replace function public.request_permission(
  p_permission text,
  p_resource_route text default null::text,
  p_reason text default ''::text
) returns public.permission_requests
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.require_company_id();
  v_permission text := btrim(coalesce(p_permission, ''));
  v_route text := nullif(btrim(coalesce(p_resource_route, '')), '');
  v_role text := public.current_app_role();
  result public.permission_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not exists(select 1 from public.app_permission_catalog c where c.permission = v_permission) then
    raise exception 'Unknown permission' using errcode = '22023';
  end if;
  if public.role_has_app_permission(v_role, v_permission)
     or exists(select 1 from public.user_permission_grants g where g.company_id = v_company and g.user_id = auth.uid() and g.permission = v_permission and g.revoked_at is null) then
    raise exception 'Permission is already granted' using errcode = '23505';
  end if;
  if not exists(select 1 from public.app_permission_catalog c where c.permission = v_permission and c.requestable) then
    raise exception 'Permission is not requestable' using errcode = '22023';
  end if;

  select * into result from public.permission_requests pr
  where pr.company_id = v_company and pr.requester_user_id = auth.uid()
    and pr.permission = v_permission and coalesce(pr.resource_route, '') = coalesce(v_route, '')
    and pr.status = 'PENDING'
  order by pr.created_at desc limit 1;
  if result.id is not null then return result; end if;

  insert into public.permission_requests(company_id, requester_user_id, permission, resource_route, reason)
  values (v_company, auth.uid(), v_permission, v_route, btrim(coalesce(p_reason, '')))
  returning * into result;

  insert into public.app_notifications(
    id, company_id, recipient_user_id, created_at, is_read, role, type, title, message,
    link, source_type, source_id, notification_type
  )
  select result.id::text || ':' || cm.user_id::text || ':permission', v_company, cm.user_id, now(), false,
    cm.role::text, 'permission_request', 'طلب صلاحية جديد',
    coalesce(requester.full_name, requester.name, requester.email, 'مستخدم') || ' طلب ' || catalog.label_ar,
    '/settings?section=users-permissions&sub=permission-requests', 'permission_request', result.id, 'permission_request'
  from public.company_members cm
  join public.companies c on c.id = cm.company_id
  join public.users u on u.id = cm.user_id
  cross join public.app_permission_catalog catalog
  left join public.users requester on requester.id = auth.uid()
  where cm.company_id = v_company
    and cm.is_active and c.is_active
    and u.deleted_at is null and u.is_active and u.status::text = 'ACTIVE'
    and cm.role = 'ADMIN' and catalog.permission = v_permission
  on conflict (id) do nothing;

  insert into public.audit_log(id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  select gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), 'PERMISSION_REQUESTED',
    'permission_request', result.id::text, 'طلب صلاحية جديد', 'permission_requests',
    jsonb_build_object('company_id', result.company_id, 'permission', result.permission, 'resource_route', result.resource_route)::text, now()
  where not exists(select 1 from public.audit_log a where a.action = 'PERMISSION_REQUESTED' and a.entity_id = result.id::text);
  return result;
end;
$$;

alter function public.request_permission(text, text, text) owner to postgres;


-- ---------------------------------------------------------------------------
-- Replace remaining functions that read public.users.role for runtime
-- authorization. They now derive the role from the active company membership.
-- ---------------------------------------------------------------------------

-- Contract evidence operate/verify predicates.
create or replace function public.contract_evidence_actor_can_operate()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select public.active_company_role() in ('ADMIN','MANAGER','OPERATIONS') $$;
alter function public.contract_evidence_actor_can_operate() owner to postgres;

create or replace function public.contract_evidence_actor_can_verify()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select public.active_company_role() in ('ADMIN','MANAGER') $$;
alter function public.contract_evidence_actor_can_verify() owner to postgres;

-- Balance recalculation is an admin/manager office operation.
create or replace function public.recalculate_all_balances()
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare v_company_id uuid;
begin
  if auth.uid() is null then
    raise exception 'غير مصرح: يجب تسجيل الدخول' using errcode = '42501';
  end if;
  if public.active_company_role() not in ('ADMIN','MANAGER') then
    raise exception 'غير مصرح: هذه العملية متاحة فقط لمالك الشركة أو مسؤول المكتب' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  delete from public.contract_balances where company_id = v_company_id;
  insert into public.contract_balances (
    contract_id, tenant_id, unit_id, total_invoiced, total_paid, balance_due, updated_at, company_id
  )
  select c.id::text, c.tenant_id::text, c.unit_id::text,
    coalesce(sum(i.amount + coalesce(i.tax_amount,0)),0),
    coalesce(sum(i.paid_amount),0),
    coalesce(sum(i.amount + coalesce(i.tax_amount,0) - i.paid_amount),0),
    now(), c.company_id
  from public.contracts c
  left join public.invoices i on i.contract_id = c.id and i.deleted_at is null and i.company_id = v_company_id
  where c.company_id = v_company_id
  group by c.id, c.tenant_id, c.unit_id, c.company_id;
end;
$$;
alter function public.recalculate_all_balances() owner to postgres;

-- Receipt VOID requests are ADMIN-only (sensitive finance).
create or replace function public.request_receipt_void_atomic(payload jsonb)
returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid := public.current_company_id();
  v_requested_id text := nullif(btrim(payload->>'receipt_id'),'');
  v_reason text := nullif(btrim(payload->>'reason'),'');
  v_request_id text := nullif(btrim(payload->>'request_id'),'');
  v_receipt public.receipts%rowtype;
  v_existing public.receipt_void_requests%rowtype;
  v_row public.receipt_void_requests%rowtype;
begin
  if v_actor is null or not public.current_user_has_effective_app_permission('financial.receipts.void') then
    raise exception 'financial.receipts.void is required to request receipt VOID' using errcode = '42501';
  end if;
  if v_company_id is null then
    raise exception 'Company context is required to request receipt VOID.' using errcode = '42501';
  end if;
  if v_requested_id is null or v_reason is null or v_request_id is null then
    raise exception 'receipt_id, reason, and request_id are required.' using errcode = '22023';
  end if;
  select r.* into v_receipt from public.receipts r
   where r.company_id = v_company_id and r.deleted_at is null and r.id::text = v_requested_id;
  if not found then
    raise exception 'RECEIPT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_existing from public.receipt_void_requests
   where receipt_id = v_receipt.id and status = 'PENDING';
  if found then
    return jsonb_build_object('id', v_existing.id::text, 'idempotent', true, 'status', v_existing.status);
  end if;
  insert into public.receipt_void_requests(receipt_id, requester_user_id, reason, status, request_id, company_id)
  values (v_receipt.id, v_actor, v_reason, 'PENDING', v_request_id, v_company_id)
  returning * into v_row;
  return jsonb_build_object('id', v_row.id::text, 'idempotent', false, 'status', v_row.status);
end;
$$;
alter function public.request_receipt_void_atomic(jsonb) owner to postgres;

-- Maintenance resolution with an expense is an admin/manager office operation.
create or replace function public.resolve_maintenance_with_expense(
  p_request_id text, p_cost numeric, p_notes text default null::text
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_record public.maintenance_records;
  v_expense_id text;
  v_company_id uuid;
begin
  perform set_config('malek.maintenance_transition_sanctioned','true',true);
  if auth.uid() is null then
    raise exception 'غير مصرح: يجب تسجيل الدخول' using errcode = '42501';
  end if;
  if public.active_company_role() not in ('ADMIN','MANAGER') then
    raise exception 'غير مصرح: هذه العملية متاحة فقط لمالك الشركة أو مسؤول المكتب' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if p_cost is null or p_cost < 0 then
    raise exception 'التكلفة يجب أن تكون رقماً موجباً';
  end if;
  select * into v_record from public.maintenance_records
   where id::text = p_request_id and company_id = v_company_id and deleted_at is null for update;
  if not found then raise exception 'طلب الصيانة غير موجود'; end if;
  if v_record.status in ('resolved','closed','cancelled') then
    raise exception 'تم إغلاق هذا الطلب مسبقاً';
  end if;
  if p_cost > 0 then
    insert into public.expenses(property_id, category, amount, expense_date, company_id, description)
    values (v_record.property_id, 'maintenance', p_cost, current_date, v_company_id, coalesce(p_notes, 'مصروف صيانة: '||v_record.title))
    returning id::text into v_expense_id;
  end if;
  update public.maintenance_records
     set status = 'resolved', resolved_at = now(), resolution_notes = p_notes, updated_at = now()
   where id = v_record.id;
  return jsonb_build_object('id', v_record.id::text, 'status','resolved', 'expense_id', v_expense_id);
end;
$$;
alter function public.resolve_maintenance_with_expense(text, numeric, text) owner to postgres;

-- The access-token hook must derive the JWT role from the active company
-- membership, not from users.role.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  claims jsonb;
  user_role text;
  requested_company_id uuid;
  user_company uuid;
  user_metadata jsonb;
  v_user_id uuid := (event->>'user_id')::uuid;
begin
  select au.raw_user_meta_data into user_metadata from auth.users au where au.id = v_user_id;

  begin
    requested_company_id := nullif(user_metadata->>'company_id','')::uuid;
  exception when invalid_text_representation then
    requested_company_id := null;
  end;

  if requested_company_id is not null then
    select cm.company_id into user_company
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
     where cm.user_id = v_user_id and cm.company_id = requested_company_id
       and cm.is_active and c.is_active
     limit 1;
  end if;

  if user_company is null then
    select cm.company_id into user_company
      from public.company_members cm
      join public.companies c on c.id = cm.company_id
     where cm.user_id = v_user_id and cm.is_active and c.is_active
     order by cm.created_at, cm.id
     limit 1;
  end if;

  -- Role is derived from the canonical active membership. If no active
  -- membership exists, no role claim is issued (fail-closed).
  select cm.role into user_role
    from public.company_members cm
    join public.companies c on c.id = cm.company_id
   where cm.user_id = v_user_id and cm.company_id = user_company
     and cm.is_active and c.is_active
   limit 1;

  claims := event -> 'claims';
  if jsonb_typeof(claims -> 'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;
  claims := jsonb_set(claims, '{app_metadata,user_role}', to_jsonb(coalesce(user_role,'USER')));
  if user_company is not null then
    claims := jsonb_set(claims, '{app_metadata,company_id}', to_jsonb(user_company));
  else
    claims := claims #- '{app_metadata,company_id}';
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;
alter function public.custom_access_token_hook(jsonb) owner to postgres;

-- Access-change proposals record the canonical membership role, not users.role.
create or replace function public.propose_user_access_change_atomic(
  p_target_user_id uuid, p_proposed_role text, p_proposed_active boolean,
  p_reason text, p_idempotency_key uuid
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor uuid := auth.uid();
  v_company uuid := public.require_company_id();
  v_target record; v_existing record; v_admin_count integer;
begin
  if v_actor is null
     or not public.current_user_has_support_capability('support.user_lookup.view')
     or not public.is_company_member(v_company, v_actor) then
    raise exception 'SUPPORT_USER_LOOKUP_REQUIRED' using errcode = '42501';
  end if;
  p_reason := btrim(coalesce(p_reason,''));
  p_proposed_role := upper(btrim(coalesce(p_proposed_role,'')));
  if p_idempotency_key is null
     or p_proposed_role not in ('ADMIN','MANAGER','ACCOUNTANT','OPERATIONS','USER','VIEWER')
     or length(p_reason) not between 10 and 500
     or not public.support_text_is_safe(p_reason) then
    raise exception 'ACCESS_PROPOSAL_INPUT_INVALID' using errcode = '22023';
  end if;
  if p_target_user_id = v_actor then
    raise exception 'ACCESS_PROPOSAL_SELF_CHANGE_PROHIBITED' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('access_proposal:'||v_company::text||':'||p_idempotency_key::text,0));
  select * into v_existing from public.admin_user_access_change_proposals
   where company_id = v_company and idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('proposal_id',v_existing.id,'status',v_existing.status,'duplicate',true,'executed',false);
  end if;
  -- Canonical role for the target in the active company is company_members.role.
  select cm.role::text role, u.is_active, u.id
    into v_target
    from public.company_members cm
    join public.users u on u.id = cm.user_id
   where cm.user_id = p_target_user_id and cm.company_id = v_company and cm.is_active
     and u.deleted_at is null
   for update;
  if not found then
    raise exception 'ACCESS_PROPOSAL_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_target.role = 'ADMIN' and (p_proposed_role <> 'ADMIN' or not p_proposed_active) then
    select count(*) into v_admin_count
      from public.company_members cm
      join public.users u on u.id = cm.user_id
     where cm.company_id = v_company and cm.is_active and cm.role = 'ADMIN'
       and u.deleted_at is null and u.is_active;
    if v_admin_count <= 1 then
      raise exception 'ACCESS_PROPOSAL_LAST_ADMIN_PROTECTED' using errcode = '42501';
    end if;
  end if;
  insert into public.admin_user_access_change_proposals(
    company_id, target_user_id, prior_role, proposed_role, current_active,
    proposed_active, reason, requested_by, idempotency_key
  ) values (
    v_company, p_target_user_id, v_target.role, p_proposed_role,
    v_target.is_active, p_proposed_active, p_reason, v_actor, p_idempotency_key
  ) returning * into v_existing;
  insert into public.admin_support_audit_events(
    company_id, actor_id, capability, action, target_type, target_id, reason,
    outcome, idempotency_key
  ) values (
    v_company, v_actor, 'support.user_lookup.view', 'USER_ACCESS_CHANGE_PROPOSED',
    'user', p_target_user_id, p_reason, 'PENDING_OWNER_APPROVAL', p_idempotency_key
  );
  return jsonb_build_object(
    'proposal_id',v_existing.id,'status',v_existing.status,'duplicate',false,
    'current_role',v_existing.prior_role,'proposed_role',v_existing.proposed_role,
    'current_active',v_existing.current_active,'proposed_active',v_existing.proposed_active,
    'expires_at',v_existing.expires_at,'executed',false
  );
end;
$function$;
alter function public.propose_user_access_change_atomic(uuid,text,boolean,text,uuid) owner to postgres;
revoke all on function public.propose_user_access_change_atomic(uuid,text,boolean,text,uuid) from public, anon;
grant execute on function public.propose_user_access_change_atomic(uuid,text,boolean,text,uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Close authority gaps exposed by the Guardian authority-path checker:
-- sensitive SECURITY DEFINER RPCs that were missing an explicit permission
-- gate now enforce the governed permission. Function bodies are otherwise
-- unchanged; only an authorization preamble is inserted.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.preview_bank_statement_batch_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_company uuid; v_preview jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.current_user_has_effective_app_permission('financial.bank_reconciliation.view') then
    raise exception 'financial.bank_reconciliation.view is required' using errcode='42501';
  end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.current_user_has_effective_app_permission('financial.bank_reconciliation.view') then
    raise exception 'financial.bank_reconciliation.view is required' using errcode='42501';
  end if;
  v_company := public.require_company_id();
  -- Delegate to the existing internal preview implementation. The function body
  -- is large and stable; wrapping it keeps this migration minimal and auditable.
  v_preview := public.preview_bank_statement_batch_internal(payload);
  return v_preview;
exception when undefined_function then
  raise;
end;
$function$
;

alter function public.preview_bank_statement_batch_atomic(payload jsonb) owner to postgres;

CREATE OR REPLACE FUNCTION public.import_bank_statement_batch_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.current_user_has_effective_app_permission('financial.bank_reconciliation.match') then
    raise exception 'financial.bank_reconciliation.match is required' using errcode='42501';
  end if;
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.current_user_has_effective_app_permission('financial.bank_reconciliation.match') then
    raise exception 'financial.bank_reconciliation.match is required' using errcode='42501';
  end if;
  return public.import_bank_statement_batch_internal(payload);
end;
$function$
;

alter function public.import_bank_statement_batch_atomic(payload jsonb) owner to postgres;

CREATE OR REPLACE FUNCTION public.post_receipt_atomic(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if not public.current_user_has_effective_app_permission('financial.payments.create') then
    raise exception 'financial.payments.create is required' using errcode='42501';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.current_user_has_effective_app_permission('financial.payments.create') then
    raise exception 'financial.payments.create is required' using errcode='42501';
  end if;
  return public.post_receipt_atomic_internal(payload);
end;
$function$
;

alter function public.post_receipt_atomic(payload jsonb) owner to postgres;


revoke all on function public.post_receipt_atomic(jsonb) from public, anon;
grant execute on function public.post_receipt_atomic(jsonb) to authenticated, service_role;

-- Background-worker RPCs are service-role only (not browser-callable).
revoke all on function public.list_background_job_companies_atomic(integer) from public, anon, authenticated;
grant execute on function public.list_background_job_companies_atomic(integer) to service_role;
revoke all on function public.dispatch_due_background_schedules_atomic(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.dispatch_due_background_schedules_atomic(timestamptz, integer) to service_role;
revoke all on function public.claim_background_jobs_atomic(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_background_jobs_atomic(uuid, uuid, integer) to service_role;
revoke all on function public.process_background_job_atomic(uuid, uuid) from public, anon, authenticated;
grant execute on function public.process_background_job_atomic(uuid, uuid) to service_role;

-- The property creation wrapper must enforce an authority gate of its own
-- (it is SECURITY DEFINER). Delegate to the governed properties.write permission.
create or replace function public.create_property_with_versioned_agreement_atomic(
  p_title text, p_type text, p_address text, p_owner_id uuid, p_agreement_type text,
  p_commission_type text, p_commission_value numeric, p_agreement_starts_on date,
  p_agreement_ends_on date default null::date, p_owner_name text default null::text,
  p_purchase_value numeric default null::numeric, p_current_value numeric default null::numeric,
  p_status text default 'active'::text, p_notes text default null::text,
  p_collection_role text default 'OWNER_IS_CREDITOR'::text
) returns jsonb
language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare v_result jsonb; v_version jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if not public.current_user_has_effective_app_permission('properties.write') then
    raise exception 'properties.write is required to create a property' using errcode='42501';
  end if;
  if p_agreement_type <> 'property_management' then
    raise exception 'MASTER_LEASE_EXCLUDED_FROM_RC1' using errcode='0A000';
  end if;
  select public.create_property_with_agreement(
    p_title, p_type, p_address, p_owner_id, p_agreement_type,
    p_commission_type, p_commission_value, p_agreement_starts_on,
    p_agreement_ends_on, p_owner_name, p_purchase_value, p_current_value,
    p_status, p_notes
  ) into v_result;
  execute 'select to_jsonb(public.create_owner_agreement_version_atomic($1,$2))'
    into v_version
    using (v_result->>'agreement_id')::uuid,
      jsonb_build_object(
        'operating_model','OWNER_AGENCY','collection_role',p_collection_role,
        'commission_type',p_commission_type,'commission_value',p_commission_value,
        'effective_from',p_agreement_starts_on,'effective_to',p_agreement_ends_on,
        'notes',p_notes);
  if v_version->>'id' is null then
    raise exception 'OWNER_AGREEMENT_INIT_VERSION_REQUIRED' using errcode='23514';
  end if;
  return v_result;
end;
$function$;
alter function public.create_property_with_versioned_agreement_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text) owner to postgres;

commit;
