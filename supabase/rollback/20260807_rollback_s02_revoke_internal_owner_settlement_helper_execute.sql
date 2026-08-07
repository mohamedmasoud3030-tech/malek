-- Manual-only rollback for 20260807170000_s02_revoke_internal_owner_settlement_helper_execute.sql.
-- Restores the immediately preceding runtime ACL shape only; do not run during
-- normal deployment because that shape allowed authenticated EXECUTE on helpers
-- now classified as internal by S02-T10.

begin;

grant execute on function public.owner_settlement_reservable_payments(
  uuid, uuid, date, date, text
) to authenticated, service_role;
grant execute on function public.owner_settlement_reservable_expenses(
  uuid, uuid, date, date, text
) to authenticated, service_role;
grant execute on function public.assert_owner_settlement_links_backfillable()
  to authenticated, service_role;
grant execute on function public.backfill_owner_settlement_links()
  to authenticated, service_role;

commit;
