-- =============================================================================
-- Migration: fix_report_rpcs_security_definer
-- Date: 2026-07-13
-- Phase: 1B — Financial Safety Lock
-- Risk: LOW (changes security context, no data changes)
--
-- Problem:
--   rpt_owner_statement and rpt_tenant_statement are SECURITY INVOKER, running
--   with the caller's privileges instead of the definer's. All other financial
--   RPCs use SECURITY DEFINER with pinned search_path. This inconsistency means:
--   1. If RLS policies change, these functions may break or expose unexpected data
--   2. They don't match the project's security baseline
--   3. They're vulnerable to search_path manipulation attacks
--
-- Fix:
--   Convert both functions to SECURITY DEFINER with pinned search_path.
--
-- Rollback:
--   ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SECURITY INVOKER;
--   ALTER FUNCTION public.rpt_tenant_statement(uuid) SECURITY INVOKER;
--
-- Validation (post-apply):
--   SELECT proname, prosecdef
--   FROM pg_proc
--   WHERE proname IN ('rpt_owner_statement', 'rpt_tenant_statement')
--     AND pronamespace = 'public'::regnamespace;
--   -- Expected: prosecdef = true for both
-- =============================================================================

-- Convert rpt_owner_statement to SECURITY DEFINER
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SECURITY DEFINER;
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) SET search_path = public, pg_temp;

-- Convert rpt_tenant_statement to SECURITY DEFINER
ALTER FUNCTION public.rpt_tenant_statement(uuid) SECURITY DEFINER;
ALTER FUNCTION public.rpt_tenant_statement(uuid) SET search_path = public, pg_temp;

-- Preserve grants (ensure they match project baseline)
REVOKE ALL ON FUNCTION public.rpt_owner_statement(uuid,date,date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_owner_statement(uuid,date,date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpt_tenant_statement(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.rpt_tenant_statement(uuid) TO authenticated, service_role;

-- Set ownership to postgres (matching other financial RPCs)
ALTER FUNCTION public.rpt_owner_statement(uuid,date,date) OWNER TO postgres;
ALTER FUNCTION public.rpt_tenant_statement(uuid) OWNER TO postgres;

-- Post-flight: verify security context was updated
DO $$
DECLARE
  v_owner_def boolean;
  v_tenant_def boolean;
BEGIN
  SELECT prosecdef INTO v_owner_def
  FROM pg_proc
  WHERE proname = 'rpt_owner_statement'
    AND pronamespace = 'public'::regnamespace;

  SELECT prosecdef INTO v_tenant_def
  FROM pg_proc
  WHERE proname = 'rpt_tenant_statement'
    AND pronamespace = 'public'::regnamespace;

  IF NOT v_owner_def THEN
    RAISE EXCEPTION 'Post-flight check failed: rpt_owner_statement is not SECURITY DEFINER';
  END IF;

  IF NOT v_tenant_def THEN
    RAISE EXCEPTION 'Post-flight check failed: rpt_tenant_statement is not SECURITY DEFINER';
  END IF;

  RAISE NOTICE 'rpt_owner_statement and rpt_tenant_statement successfully converted to SECURITY DEFINER';
END $$;
