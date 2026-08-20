-- P6.1 cumulative remediation: permission workflow authority, notification delivery,
-- and the single typed document-vault foundation. No accounting/GL objects change.
begin;

-- ---------------------------------------------------------------------------
-- Typed document foundation + legacy contract-document compatibility backfill
-- ---------------------------------------------------------------------------
alter table public.vault_documents add column if not exists document_type text;
alter table public.vault_documents add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.vault_documents drop constraint if exists vault_documents_related_entity_type_check;
alter table public.vault_documents add constraint vault_documents_related_entity_type_check
  check (related_entity_type is null or related_entity_type in (
    'property','unit','land','person','contract','invoice','payment','receipt',
    'expense','maintenance','utility_bill','tenant','owner'
  ));
alter table public.vault_documents drop constraint if exists vault_documents_category_check;
alter table public.vault_documents add constraint vault_documents_category_check
  check (category in ('all','contracts','identity','receipts','maintenance','expenses','utilities','other'));

update public.vault_documents
set document_type = case when mime_type = 'application/pdf' then 'pdf' when mime_type like 'image/%' then 'image' else 'attachment' end,
    metadata = jsonb_strip_nulls(jsonb_build_object(
      'originalFileName', file_name,
      'contentType', mime_type,
      'sizeBytes', file_size
    ))
where document_type is null;

insert into public.vault_documents (
  id, company_id, title, category, document_type, metadata,
  related_entity_type, related_entity_id, file_name, file_url, storage_path,
  file_size, mime_type, uploaded_by, created_at, updated_at, deleted_at
)
select
  cd.id, cd.company_id, cd.file_name, 'contracts',
  case when cd.mime_type = 'application/pdf' then 'pdf' when cd.mime_type like 'image/%' then 'image' else 'attachment' end,
  jsonb_strip_nulls(jsonb_build_object('originalFileName', cd.file_name, 'contentType', cd.mime_type, 'sizeBytes', cd.file_size)),
  'contract', cd.contract_id::text, cd.file_name, cd.file_url, cd.storage_path,
  cd.file_size, cd.mime_type, cd.uploaded_by, cd.created_at, cd.created_at, cd.deleted_at
from public.contract_documents cd
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Semantic permission catalog (the database whitelist)
-- ---------------------------------------------------------------------------
create table if not exists public.app_permission_catalog (
  permission text primary key,
  label_ar text not null,
  admin_only boolean not null default false,
  requestable boolean not null default true
);
alter table public.app_permission_catalog enable row level security;
drop policy if exists app_permission_catalog_read on public.app_permission_catalog;
create policy app_permission_catalog_read on public.app_permission_catalog
  for select to authenticated using (public.is_app_user());
grant select on public.app_permission_catalog to authenticated;
revoke insert, update, delete on public.app_permission_catalog from authenticated, anon;

insert into public.app_permission_catalog(permission, label_ar, admin_only, requestable) values
  ('app.dashboard.view','عرض لوحة التحكم',false,false),
  ('audit.view','عرض سجل التدقيق',true,true),
  ('integrity.view','عرض سلامة البيانات',true,true),
  ('maintenance.view','عرض الصيانة',false,true),
  ('system.view','عرض إعدادات النظام والحوكمة',true,true),
  ('users.manage','إدارة المستخدمين والأدوار',true,true),
  ('permission_requests.review','مراجعة طلبات الصلاحية',false,false),
  ('company.settings.manage','إدارة إعدادات الشركة',true,true),
  ('cost_centers.manage','إدارة مراكز التكلفة',false,true),
  ('documents.write','رفع واستبدال وأرشفة المستندات',false,true),
  ('owners.hub.view','عرض سجل الملاك',false,true),
  ('owners.detail.view','عرض ملف المالك',false,true),
  ('lands.view','عرض الأراضي',false,true),
  ('leads.view','عرض العملاء المحتملين',false,true),
  ('commissions.view','عرض العمولات',false,true),
  ('communication.view','عرض التواصل والمتابعات',false,true),
  ('automation.view','عرض الأتمتة',false,true),
  ('auth.password.change','تغيير كلمة المرور',false,false),
  ('settings.manage','إدارة الإعدادات القديمة',true,true),
  ('properties.write','إضافة وتعديل العقارات',false,true),
  ('contracts.write','إضافة وتعديل العقود',false,true),
  ('expenses.view','عرض المصروفات',false,true),
  ('expenses.write','إضافة وتعديل المصروفات',false,true),
  ('arrears.view','عرض المتأخرات',false,true),
  ('financial.deposits.view','عرض التأمينات',false,true),
  ('financial.invoices.generate','إنشاء الفواتير',false,true),
  ('financial.invoices.export','تصدير الفواتير',false,true),
  ('financial.payments.create','تسجيل التحصيلات',false,true),
  ('financial.receipts.void','إلغاء الإيصالات',true,true),
  ('financial.reports.export','تصدير التقارير المالية',false,true),
  ('financial.bank_reconciliation.view','عرض المطابقة البنكية',false,true),
  ('financial.bank_reconciliation.match','تنفيذ المطابقة البنكية',false,true),
  ('financial.owner_settlements.view','عرض تسويات الملاك',false,true),
  ('financial.owner_settlements.approve','اعتماد تسويات الملاك',true,true),
  ('financial.owner_settlements.pay','صرف تسويات الملاك',true,true)
on conflict (permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

create or replace function public.role_has_app_permission(p_role text, p_permission text)
returns boolean language sql stable security invoker set search_path = public, pg_temp
as $$
  select case upper(coalesce(p_role, ''))
    when 'ADMIN' then exists(select 1 from public.app_permission_catalog c where c.permission = p_permission)
    when 'MANAGER' then p_permission = any(array[
      'app.dashboard.view','maintenance.view','permission_requests.review','cost_centers.manage','documents.write',
      'owners.hub.view','owners.detail.view','lands.view','leads.view','commissions.view','communication.view',
      'automation.view','auth.password.change','properties.write','contracts.write','expenses.view','expenses.write',
      'arrears.view','financial.deposits.view','financial.invoices.generate','financial.invoices.export',
      'financial.payments.create','financial.receipts.void','financial.reports.export',
      'financial.bank_reconciliation.view','financial.bank_reconciliation.match','financial.owner_settlements.view'
    ]::text[])
    when 'USER' then p_permission = any(array['app.dashboard.view','auth.password.change']::text[])
    else false
  end
$$;
revoke all on function public.role_has_app_permission(text,text) from public, anon;
grant execute on function public.role_has_app_permission(text,text) to authenticated, service_role;

create or replace function public.enforce_app_permission_catalog()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.app_permission_catalog c where c.permission = new.permission) then
    raise exception 'Unknown permission' using errcode = '22023';
  end if;
  return new;
end;
$$;
drop trigger if exists permission_requests_catalog_guard on public.permission_requests;
create trigger permission_requests_catalog_guard before insert or update of permission on public.permission_requests
for each row execute function public.enforce_app_permission_catalog();
drop trigger if exists user_permission_grants_catalog_guard on public.user_permission_grants;
create trigger user_permission_grants_catalog_guard before insert or update of permission on public.user_permission_grants
for each row execute function public.enforce_app_permission_catalog();
revoke all on function public.enforce_app_permission_catalog() from public, anon, authenticated;

-- Direct browser writes are forbidden; trusted RPCs below are the mutation seam.
drop policy if exists permission_requests_insert_self on public.permission_requests;
drop policy if exists permission_requests_update_manager on public.permission_requests;
drop policy if exists permission_grants_manager_write on public.user_permission_grants;
revoke insert, update, delete on public.permission_requests from authenticated, anon;
revoke insert, update, delete on public.user_permission_grants from authenticated, anon;
grant select on public.permission_requests, public.user_permission_grants to authenticated;

drop policy if exists permission_requests_read_company on public.permission_requests;
create policy permission_requests_read_company on public.permission_requests
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (requester_user_id = auth.uid() or public.is_admin_or_manager())
  );
drop policy if exists permission_grants_read_self_or_manager on public.user_permission_grants;
create policy permission_grants_read_self_or_manager on public.user_permission_grants
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (user_id = auth.uid() or public.is_admin_or_manager())
  );

-- Company settings are an ADMIN semantic permission, not a side effect of MANAGER.
drop policy if exists manager_write_company_settings on public.company_settings;
create policy admin_write_company_settings on public.company_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- User-specific notifications give every reviewer an independent read state.
alter table public.app_notifications add column if not exists recipient_user_id uuid references auth.users(id) on delete cascade;
create index if not exists app_notifications_recipient_unread_idx
  on public.app_notifications(company_id, recipient_user_id, is_read, created_at desc)
  where deleted_at is null;
drop policy if exists app_user_app_notifications on public.app_notifications;
drop policy if exists app_notifications_read_own on public.app_notifications;
drop policy if exists app_notifications_update_own on public.app_notifications;
create policy app_notifications_read_own on public.app_notifications
  for select to authenticated
  using (
    company_id = public.current_company_id()
    and (recipient_user_id = auth.uid() or (recipient_user_id is null and (role is null or role = (select u.role::text from public.users u where u.id = auth.uid()))))
  );
create policy app_notifications_update_own on public.app_notifications
  for update to authenticated
  using (company_id = public.current_company_id() and recipient_user_id = auth.uid())
  with check (company_id = public.current_company_id() and recipient_user_id = auth.uid());
revoke insert, delete on public.app_notifications from authenticated, anon;
grant select, update(is_read) on public.app_notifications to authenticated;

create or replace function public.request_permission(
  p_permission text,
  p_resource_route text default null,
  p_reason text default ''
) returns public.permission_requests
language plpgsql security definer set search_path = public, pg_temp
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
  select result.id::text || ':' || u.id::text || ':permission', v_company, u.id, now(), false, u.role::text,
    'permission_request', 'طلب صلاحية جديد',
    coalesce(requester.full_name, requester.name, requester.email, 'مستخدم') || ' طلب ' || catalog.label_ar,
    '/settings?section=users-permissions&sub=permission-requests', 'permission_request', result.id, 'permission_request'
  from public.users u
  join public.company_members cm on cm.user_id = u.id and cm.company_id = v_company and cm.is_active
  cross join public.app_permission_catalog catalog
  left join public.users requester on requester.id = auth.uid()
  where u.deleted_at is null and u.is_active and u.status::text = 'ACTIVE'
    and u.role::text in ('ADMIN','MANAGER') and catalog.permission = v_permission
  on conflict (id) do nothing;

  insert into public.audit_log(id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  select gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), 'PERMISSION_REQUESTED',
    'permission_request', result.id::text, 'طلب صلاحية جديد', 'permission_requests',
    jsonb_build_object('company_id', result.company_id, 'permission', result.permission, 'resource_route', result.resource_route)::text, now()
  where not exists(select 1 from public.audit_log a where a.action = 'PERMISSION_REQUESTED' and a.entity_id = result.id::text);
  return result;
end;
$$;
revoke all on function public.request_permission(text,text,text) from public, anon;
grant execute on function public.request_permission(text,text,text) to authenticated;

create or replace function public.list_permission_requests_for_review(p_status text default null)
returns table(
  id uuid, requester_user_id uuid, requester_name text, requester_email text,
  permission text, resource_route text, reason text, status text,
  reviewer_user_id uuid, decided_at timestamptz, decision_reason text, created_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_company uuid := public.require_company_id();
begin
  if public.current_app_role() not in ('ADMIN','MANAGER') then
    raise exception 'Permission request review required' using errcode = '42501';
  end if;
  return query
  select pr.id, pr.requester_user_id, coalesce(u.full_name, u.name), u.email,
    pr.permission, pr.resource_route, pr.reason, pr.status,
    pr.reviewer_user_id, pr.decided_at, pr.decision_reason, pr.created_at
  from public.permission_requests pr
  left join public.users u on u.id = pr.requester_user_id
  where pr.company_id = v_company and (p_status is null or pr.status = upper(p_status))
  order by pr.created_at desc;
end;
$$;
revoke all on function public.list_permission_requests_for_review(text) from public, anon;
grant execute on function public.list_permission_requests_for_review(text) to authenticated;

create or replace function public.decide_permission_request(
  p_request_id uuid,
  p_decision text,
  p_reason text default null
) returns public.permission_requests
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.require_company_id();
  v_decision text := upper(btrim(coalesce(p_decision, '')));
  v_role text := public.current_app_role();
  result public.permission_requests;
  v_admin_only boolean;
begin
  if v_role not in ('ADMIN','MANAGER') then raise exception 'Permission request review required' using errcode = '42501'; end if;
  if v_decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision' using errcode = '22023'; end if;
  if v_decision = 'REJECTED' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Rejection reason is required' using errcode = '22023';
  end if;

  select * into result from public.permission_requests pr
  where pr.id = p_request_id and pr.company_id = v_company for update;
  if result.id is null then raise exception 'Permission request not found' using errcode = 'P0002'; end if;
  if result.requester_user_id = auth.uid() then raise exception 'Requester cannot review own request' using errcode = '42501'; end if;
  if result.status <> 'PENDING' then
    if result.status = v_decision then return result; end if;
    raise exception 'Permission request already decided' using errcode = '23505';
  end if;
  select c.admin_only into v_admin_only from public.app_permission_catalog c where c.permission = result.permission;
  if v_decision = 'APPROVED' and v_role = 'MANAGER' and coalesce(v_admin_only, true) then
    raise exception 'Manager cannot grant an admin-only permission' using errcode = '42501';
  end if;

  update public.permission_requests
  set status = v_decision, reviewer_user_id = auth.uid(), decided_at = now(),
      decision_reason = nullif(btrim(coalesce(p_reason, '')), ''), updated_at = now()
  where id = result.id returning * into result;

  if result.status = 'APPROVED' then
    insert into public.user_permission_grants(company_id, user_id, permission, granted_by)
    values (result.company_id, result.requester_user_id, result.permission, auth.uid())
    on conflict (company_id, user_id, permission)
    do update set revoked_at = null, granted_by = excluded.granted_by, granted_at = now();
  end if;

  insert into public.app_notifications(id, company_id, recipient_user_id, created_at, is_read, role, type, title, message, link, source_type, source_id, notification_type)
  values (
    result.id::text || ':' || result.requester_user_id::text || ':decision', result.company_id,
    result.requester_user_id, now(), false, null, 'permission_decision',
    case when result.status = 'APPROVED' then 'تمت الموافقة على طلب الصلاحية' else 'تم رفض طلب الصلاحية' end,
    coalesce(result.decision_reason, 'تم اتخاذ قرار بشأن الطلب.'), coalesce(result.resource_route, '/dashboard'),
    'permission_request', result.id, 'permission_decision'
  ) on conflict (id) do nothing;

  insert into public.audit_log(id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  select gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), 'PERMISSION_' || result.status,
    'permission_request', result.id::text, coalesce(result.decision_reason, 'تم اتخاذ قرار بشأن طلب الصلاحية'),
    'permission_requests', jsonb_build_object('requester_user_id', result.requester_user_id, 'permission', result.permission, 'resource_route', result.resource_route)::text, now()
  where not exists(select 1 from public.audit_log a where a.action = 'PERMISSION_' || result.status and a.entity_id = result.id::text);
  return result;
end;
$$;
revoke all on function public.decide_permission_request(uuid,text,text) from public, anon;
grant execute on function public.decide_permission_request(uuid,text,text) to authenticated;

create or replace function public.revoke_permission_grant(p_user_id uuid, p_permission text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_company uuid := public.require_company_id();
  v_role text := public.current_app_role();
  v_admin_only boolean;
  v_grant_id uuid;
begin
  if v_role not in ('ADMIN','MANAGER') then raise exception 'Permission request review required' using errcode = '42501'; end if;
  if p_user_id = auth.uid() then raise exception 'Reviewer cannot revoke own grant' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Revocation reason is required' using errcode = '22023'; end if;
  select c.admin_only into v_admin_only from public.app_permission_catalog c where c.permission = p_permission;
  if v_admin_only is null then raise exception 'Unknown permission' using errcode = '22023'; end if;
  if v_role = 'MANAGER' and v_admin_only then raise exception 'Manager cannot revoke an admin-only permission' using errcode = '42501'; end if;

  update public.user_permission_grants g set revoked_at = now()
  where g.company_id = v_company and g.user_id = p_user_id and g.permission = p_permission and g.revoked_at is null
  returning g.id into v_grant_id;
  if v_grant_id is null then return jsonb_build_object('revoked', false); end if;

  insert into public.audit_log(id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), 'PERMISSION_REVOKED', 'permission_grant', v_grant_id::text,
    btrim(p_reason), 'user_permission_grants', jsonb_build_object('user_id', p_user_id, 'permission', p_permission, 'company_id', v_company)::text, now());
  insert into public.app_notifications(id, company_id, recipient_user_id, created_at, is_read, type, title, message, link, source_type, source_id, notification_type)
  values (v_grant_id::text || ':' || p_user_id::text || ':revoked', v_company, p_user_id, now(), false,
    'permission_decision', 'تم إلغاء صلاحية', btrim(p_reason), '/settings?section=security', 'permission_grant', v_grant_id, 'permission_revoked')
  on conflict (id) do nothing;
  return jsonb_build_object('revoked', true);
end;
$$;
revoke all on function public.revoke_permission_grant(uuid,text,text) from public, anon;
grant execute on function public.revoke_permission_grant(uuid,text,text) to authenticated;

commit;
