-- P6.1 closeout: live effective authority for permission review/delegation.
-- Historical APPROVED requests remain immutable evidence; only active grants
-- authorize a user or prove a permission is currently active.
begin;

create or replace function public.current_user_has_effective_app_permission(p_permission text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_company uuid := public.require_company_id();
begin
  if public.is_admin() then return true; end if;
  return public.role_has_app_permission(public.current_app_role(), p_permission)
    or exists (
      select 1 from public.user_permission_grants g
      where g.company_id = v_company and g.user_id = auth.uid()
        and g.permission = p_permission and g.revoked_at is null
    );
end;
$$;
revoke all on function public.current_user_has_effective_app_permission(text) from public, anon;
grant execute on function public.current_user_has_effective_app_permission(text) to authenticated;

-- Delegation is strictly bounded: a reviewer may only approve/revoke a
-- capability they currently hold. ADMIN is the documented emergency override.
create or replace function public.current_user_can_delegate_app_permission(p_permission text)
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select public.is_admin() or public.current_user_has_effective_app_permission(p_permission) $$;
revoke all on function public.current_user_can_delegate_app_permission(text) from public, anon;
grant execute on function public.current_user_can_delegate_app_permission(text) to authenticated;

drop function if exists public.list_permission_requests_for_review(text);
create function public.list_permission_requests_for_review(p_status text default null)
returns table(
  id uuid, requester_user_id uuid, requester_name text, requester_email text,
  permission text, resource_route text, reason text, status text,
  reviewer_user_id uuid, decided_at timestamptz, decision_reason text, created_at timestamptz,
  grant_active boolean
)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_company uuid := public.require_company_id();
begin
  if not public.current_user_has_effective_app_permission('permission_requests.review') then
    raise exception 'Permission request review required' using errcode = '42501';
  end if;
  return query
  select pr.id, pr.requester_user_id, coalesce(u.full_name, u.name), u.email,
    pr.permission, pr.resource_route, pr.reason, pr.status,
    pr.reviewer_user_id, pr.decided_at, pr.decision_reason, pr.created_at,
    exists(select 1 from public.user_permission_grants g where g.company_id=pr.company_id and g.user_id=pr.requester_user_id and g.permission=pr.permission and g.revoked_at is null)
  from public.permission_requests pr left join public.users u on u.id = pr.requester_user_id
  where pr.company_id = v_company and (p_status is null or pr.status = upper(p_status))
  order by pr.created_at desc;
end;
$$;

create or replace function public.decide_permission_request(p_request_id uuid, p_decision text, p_reason text default null)
returns public.permission_requests
language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_company uuid := public.require_company_id(); v_decision text := upper(btrim(coalesce(p_decision, ''))); result public.permission_requests; v_admin_only boolean;
begin
  if not public.current_user_has_effective_app_permission('permission_requests.review') then raise exception 'Permission request review required' using errcode = '42501'; end if;
  if v_decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision' using errcode = '22023'; end if;
  if v_decision = 'REJECTED' and nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'Rejection reason is required' using errcode = '22023'; end if;
  select * into result from public.permission_requests pr where pr.id=p_request_id and pr.company_id=v_company for update;
  if result.id is null then raise exception 'Permission request not found' using errcode = 'P0002'; end if;
  if result.requester_user_id = auth.uid() then raise exception 'Requester cannot review own request' using errcode = '42501'; end if;
  if result.status <> 'PENDING' then if result.status = v_decision then return result; end if; raise exception 'Permission request already decided' using errcode = '23505'; end if;
  if v_decision = 'APPROVED' and not public.current_user_can_delegate_app_permission(result.permission) then
    select admin_only into v_admin_only from public.app_permission_catalog where permission=result.permission;
    if v_admin_only then raise exception 'Manager cannot grant an admin-only permission' using errcode = '42501'; end if;
    raise exception 'Reviewer cannot grant this permission' using errcode = '42501';
  end if;
  update public.permission_requests set status=v_decision, reviewer_user_id=auth.uid(), decided_at=now(), decision_reason=nullif(btrim(coalesce(p_reason,'')),''), updated_at=now() where id=result.id returning * into result;
  if result.status='APPROVED' then insert into public.user_permission_grants(company_id,user_id,permission,granted_by) values(result.company_id,result.requester_user_id,result.permission,auth.uid()) on conflict(company_id,user_id,permission) do update set revoked_at=null, granted_by=excluded.granted_by, granted_at=now(); end if;
  insert into public.app_notifications(id,company_id,recipient_user_id,created_at,is_read,role,type,title,message,link,source_type,source_id,notification_type)
  values(result.id::text||':'||result.requester_user_id::text||':decision',result.company_id,result.requester_user_id,now(),false,null,'permission_decision',case when result.status='APPROVED' then 'تمت الموافقة على طلب الصلاحية' else 'تم رفض طلب الصلاحية' end,coalesce(result.decision_reason,'تم اتخاذ قرار بشأن الطلب.'),coalesce(result.resource_route,'/dashboard'),'permission_request',result.id,'permission_decision') on conflict(id) do nothing;
  insert into public.audit_log(id,ts,user_id,action,entity,entity_id,note,"table",details,created_at)
  select gen_random_uuid(),extract(epoch from now())::bigint,auth.uid(),'PERMISSION_'||result.status,'permission_request',result.id::text,coalesce(result.decision_reason,'تم اتخاذ قرار بشأن طلب الصلاحية'),'permission_requests',jsonb_build_object('requester_user_id',result.requester_user_id,'permission',result.permission,'resource_route',result.resource_route)::text,now()
  where not exists(select 1 from public.audit_log a where a.action='PERMISSION_'||result.status and a.entity_id=result.id::text);
  return result;
end;
$$;

create or replace function public.revoke_permission_grant(p_user_id uuid, p_permission text, p_reason text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_company uuid := public.require_company_id(); v_grant_id uuid;
begin
  if not public.current_user_has_effective_app_permission('permission_requests.review') then raise exception 'Permission request review required' using errcode = '42501'; end if;
  if p_user_id=auth.uid() then raise exception 'Reviewer cannot revoke own grant' using errcode = '42501'; end if;
  if nullif(btrim(coalesce(p_reason,'')), '') is null then raise exception 'Revocation reason is required' using errcode = '22023'; end if;
  if not exists(select 1 from public.app_permission_catalog where permission=p_permission) then raise exception 'Unknown permission' using errcode = '22023'; end if;
  if not public.current_user_can_delegate_app_permission(p_permission) then raise exception 'Reviewer cannot revoke this permission' using errcode = '42501'; end if;
  update public.user_permission_grants set revoked_at=now() where company_id=v_company and user_id=p_user_id and permission=p_permission and revoked_at is null returning id into v_grant_id;
  if v_grant_id is not null then
    insert into public.audit_log(id,ts,user_id,action,entity,entity_id,note,"table",details,created_at) values(gen_random_uuid(),extract(epoch from now())::bigint,auth.uid(),'PERMISSION_REVOKED','permission_grant',v_grant_id::text,btrim(p_reason),'user_permission_grants',jsonb_build_object('user_id',p_user_id,'permission',p_permission,'company_id',v_company)::text,now());
    insert into public.app_notifications(id,company_id,recipient_user_id,created_at,is_read,type,title,message,link,source_type,source_id,notification_type) values(v_grant_id::text||':'||p_user_id::text||':revoked',v_company,p_user_id,now(),false,'permission_decision','تم إلغاء صلاحية',btrim(p_reason),'/settings?section=security','permission_grant',v_grant_id,'permission_revoked') on conflict(id) do nothing;
  end if;
  return jsonb_build_object('revoked', v_grant_id is not null);
end;
$$;
revoke all on function public.list_permission_requests_for_review(text), public.decide_permission_request(uuid,text,text), public.revoke_permission_grant(uuid,text,text) from public, anon;
grant execute on function public.list_permission_requests_for_review(text), public.decide_permission_request(uuid,text,text), public.revoke_permission_grant(uuid,text,text) to authenticated;

commit;
