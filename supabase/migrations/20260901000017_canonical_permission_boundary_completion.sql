-- Canonical permission-boundary completion (governance stabilization, Phase 5).
--
-- Two remaining helpers were logically close to the canonical model but still
-- bypassed one of its fail-closed invariants:
--   * current_user_can_delegate_app_permission() gave ADMIN an independent
--     shortcut before catalog validation.
--   * authorize_ai_assistant_access() reimplemented the caller-role lookup
--     directly against company_members instead of using the canonical role
--     resolver. The membership source was correct, but duplicating the lookup
--     creates drift risk and violates the single-resolver contract.

begin;

CREATE OR REPLACE FUNCTION public.current_user_can_delegate_app_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  select public.current_user_has_effective_app_permission(p_permission);
$function$;

CREATE OR REPLACE FUNCTION public.authorize_ai_assistant_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user uuid := auth.uid();
  v_company uuid := public.require_company_id();
begin
  if v_user is null
     or not coalesce(public.is_app_user(), false)
     or not coalesce(public.is_company_member(v_company, v_user), false)
     or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'AI_ASSISTANT_ACCESS_DENIED' using errcode = '42501';
  end if;

  return jsonb_build_object('allowed', true);
end;
$function$;

COMMENT ON FUNCTION public.authorize_ai_assistant_access()
IS 'Fail-closed active-company AI Assistant authorization. ADMIN/MANAGER parity is resolved exclusively through the canonical active-company role resolver until an approved AI capability key replaces the temporary role gate.';

-- CREATE OR REPLACE preserves the existing owners and EXECUTE grants.

commit;
