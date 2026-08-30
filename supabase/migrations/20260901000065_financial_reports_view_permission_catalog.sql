begin;

-- ALLOW_GOVERNED_DATA_MIGRATION: canonical permission-catalog repair.
-- The role matrix has referenced financial.reports.view since migration 39,
-- but the catalog omitted it, causing the fail-closed effective resolver to
-- reject every non-admin caller regardless of the role default.
insert into public.app_permission_catalog(permission, label_ar, admin_only, requestable)
values ('financial.reports.view', 'عرض التقارير المالية', false, true)
on conflict(permission) do update set
  label_ar = excluded.label_ar,
  admin_only = excluded.admin_only,
  requestable = excluded.requestable;

commit;
