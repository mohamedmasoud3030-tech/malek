-- Optimize stable auth identity lookups inside RLS policies without changing
-- policy semantics. Wrapping auth.uid() in SELECT lets PostgreSQL evaluate the
-- value once per statement instead of once per candidate row.

begin;

alter policy app_notifications_read_own on public.app_notifications
  using (
    company_id = public.current_company_id()
    and (
      recipient_user_id = (select auth.uid())
      or (
        recipient_user_id is null
        and (
          role is null
          or role = (
            select u.role::text
            from public.users u
            where u.id = (select auth.uid())
          )
        )
      )
    )
  );

alter policy app_notifications_update_own on public.app_notifications
  using (
    company_id = public.current_company_id()
    and recipient_user_id = (select auth.uid())
  )
  with check (
    company_id = public.current_company_id()
    and recipient_user_id = (select auth.uid())
  );

alter policy companies_member_read on public.companies
  using (
    public.is_app_user()
    and public.is_company_member(id, (select auth.uid()))
  );

alter policy company_members_read_own on public.company_members
  using (
    public.is_app_user()
    and (
      user_id = (select auth.uid())
      or app_private.can_manage_company_members(company_id)
    )
  );

alter policy permission_grants_read_self_or_manager on public.user_permission_grants
  using (
    company_id = public.current_company_id()
    and (
      user_id = (select auth.uid())
      or public.is_admin_or_manager()
    )
  );

alter policy permission_requests_read_company on public.permission_requests
  using (
    company_id = public.current_company_id()
    and (
      requester_user_id = (select auth.uid())
      or public.is_admin_or_manager()
    )
  );

alter policy users_read_self_or_admin on public.users
  using (
    id = (select auth.uid())
    or public.is_admin()
  );

commit;
