begin;

create table if not exists public.permission_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  resource_route text,
  reason text not null default '',
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  reviewer_user_id uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists permission_requests_pending_unique
  on public.permission_requests(company_id, requester_user_id, permission, (coalesce(resource_route, '')))
  where status = 'PENDING';
create index if not exists permission_requests_company_status_idx
  on public.permission_requests(company_id, status, created_at desc);

create table if not exists public.user_permission_grants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null,
  granted_by uuid not null references auth.users(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique(company_id, user_id, permission)
);
create index if not exists user_permission_grants_lookup_idx
  on public.user_permission_grants(company_id, user_id, permission) where revoked_at is null;

alter table public.permission_requests enable row level security;
alter table public.user_permission_grants enable row level security;

create policy permission_requests_read_company on public.permission_requests
  for select to authenticated
  using (company_id = public.current_company_id() and (requester_user_id = auth.uid() or public.is_admin_or_manager()));
create policy permission_requests_insert_self on public.permission_requests
  for insert to authenticated
  with check (company_id = public.require_company_id() and requester_user_id = auth.uid());
create policy permission_requests_update_manager on public.permission_requests
  for update to authenticated
  using (company_id = public.current_company_id() and public.is_admin_or_manager())
  with check (company_id = public.current_company_id() and public.is_admin_or_manager());

create policy permission_grants_read_self_or_manager on public.user_permission_grants
  for select to authenticated
  using (company_id = public.current_company_id() and (user_id = auth.uid() or public.is_admin_or_manager()));
create policy permission_grants_manager_write on public.user_permission_grants
  for all to authenticated
  using (company_id = public.current_company_id() and public.is_admin_or_manager())
  with check (company_id = public.current_company_id() and public.is_admin_or_manager());

create or replace function public.request_permission(
  p_permission text,
  p_resource_route text default null,
  p_reason text default ''
) returns public.permission_requests
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare result public.permission_requests;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.permission_requests(company_id, requester_user_id, permission, resource_route, reason)
  values (public.require_company_id(), auth.uid(), btrim(p_permission), nullif(btrim(p_resource_route), ''), btrim(coalesce(p_reason, '')))
  on conflict do nothing
  returning * into result;
  if result.id is null then
    select * into result from public.permission_requests where company_id = public.require_company_id() and requester_user_id = auth.uid() and permission = btrim(p_permission) and status = 'PENDING' order by created_at desc limit 1;
  end if;
  insert into public.app_notifications(id, created_at, is_read, role, type, title, message, link, source_type, source_id, notification_type)
  values (result.id::text || ':permission', now(), false, 'MANAGER', 'permission_request', 'طلب صلاحية جديد', 'يوجد طلب صلاحية يحتاج إلى مراجعة المدير.', '/settings?section=users-roles&sub=permission-requests', 'permission_request', result.id, 'permission_request')
  on conflict (id) do nothing;
  insert into public.audit_log(id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), 'PERMISSION_REQUESTED', 'permission_request', result.id::text, 'طلب صلاحية جديد', 'permission_requests', jsonb_build_object('company_id', result.company_id, 'permission', result.permission, 'resource_route', result.resource_route)::text, now());
  return result;
end;
$$;

grant execute on function public.request_permission(text, text, text) to authenticated;

create or replace function public.decide_permission_request(
  p_request_id uuid,
  p_decision text,
  p_reason text default null
) returns public.permission_requests
language plpgsql security invoker set search_path = public, pg_temp
as $$
declare result public.permission_requests;
begin
  if not public.is_admin_or_manager() then raise exception 'Manager permission required' using errcode = '42501'; end if;
  update public.permission_requests
  set status = upper(p_decision), reviewer_user_id = auth.uid(), decided_at = now(), decision_reason = nullif(btrim(p_reason), ''), updated_at = now()
  where id = p_request_id and company_id = public.require_company_id() and status = 'PENDING'
  returning * into result;
  if result.id is null then raise exception 'Permission request is not pending or not found'; end if;
  if result.status = 'APPROVED' then
    insert into public.user_permission_grants(company_id, user_id, permission, granted_by)
    values (result.company_id, result.requester_user_id, result.permission, auth.uid())
    on conflict (company_id, user_id, permission) do update set revoked_at = null, granted_by = excluded.granted_by, granted_at = now();
  end if;
  insert into public.audit_log(id, ts, user_id, action, entity, entity_id, note, "table", details, created_at)
  values (gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(), 'PERMISSION_' || result.status, 'permission_request', result.id::text, coalesce(result.decision_reason, 'تم اتخاذ قرار بشأن طلب الصلاحية'), 'permission_requests', jsonb_build_object('requester_user_id', result.requester_user_id, 'permission', result.permission, 'decision_reason', result.decision_reason)::text, now());
  return result;
end;
$$;

grant execute on function public.decide_permission_request(uuid, text, text) to authenticated;

commit;
