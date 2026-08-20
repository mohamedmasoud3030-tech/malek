-- =============================================================================
-- Migration: fix_void_receipt_anon_grant
-- Date: 2026-07-13
-- Phase: 1B — Financial Safety Lock
-- Risk: LOW (tightens grant, no data changes)
--
-- Problem:
--   void_receipt_atomic(jsonb) grants EXECUTE to anon, allowing unauthenticated
--   users to attempt void operations. While the function's internal auth check
--   will reject them, this is a defense-in-depth violation. All other financial
--   RPCs revoke execute from anon and only grant to authenticated + service_role.
--
-- Fix:
--   Revoke EXECUTE from anon, preserving grants for authenticated and service_role.
--
-- Rollback:
--   GRANT EXECUTE ON FUNCTION public.void_receipt_atomic(jsonb) TO anon;
--
-- Validation (post-apply):
--   SELECT has_function_privilege('anon', 'public.void_receipt_atomic(jsonb)', 'execute');
--   -- Expected: false
-- =============================================================================

-- Revoke anon access (defense-in-depth)
REVOKE ALL ON FUNCTION public.void_receipt_atomic(jsonb) FROM anon;

-- Preserve authenticated and service_role access
GRANT EXECUTE ON FUNCTION public.void_receipt_atomic(jsonb) TO authenticated, service_role;

-- Post-flight: verify grants
DO $$
DECLARE
  v_anon_has_execute boolean;
  v_auth_has_execute boolean;
BEGIN
  SELECT has_function_privilege('anon', 'public.void_receipt_atomic(jsonb)', 'execute')
    INTO v_anon_has_execute;

  SELECT has_function_privilege('authenticated', 'public.void_receipt_atomic(jsonb)', 'execute')
    INTO v_auth_has_execute;

  IF v_anon_has_execute THEN
    RAISE EXCEPTION 'Post-flight check failed: anon still has execute privilege';
  END IF;

  IF NOT v_auth_has_execute THEN
    RAISE EXCEPTION 'Post-flight check failed: authenticated lost execute privilege';
  END IF;

  RAISE NOTICE 'void_receipt_atomic(jsonb) grants successfully updated: anon revoked, authenticated preserved';
END $$;
