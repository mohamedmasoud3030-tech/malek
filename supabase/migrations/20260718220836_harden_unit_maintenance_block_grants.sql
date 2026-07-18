-- Creating a SECURITY DEFINER overload on clean replay grants EXECUTE to PUBLIC
-- unless privileges are explicitly pinned. Production already had a restricted
-- overload, but this forward migration makes replay and live ACLs identical.

begin;

revoke all on function public.check_unit_maintenance_block(uuid)
from public, anon, authenticated;

grant execute on function public.check_unit_maintenance_block(uuid)
to service_role;

commit;
