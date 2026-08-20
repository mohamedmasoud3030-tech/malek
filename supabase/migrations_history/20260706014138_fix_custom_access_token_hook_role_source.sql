-- Phase 0 (Settings/Auth) audit finding F0-6: custom_access_token_hook read the
-- JWT role claim from public.profiles.role, whose CHECK constraint only allows
-- ('ADMIN','USER') and cannot represent 'MANAGER'. Meanwhile all RLS
-- authorization (is_admin_or_manager(), is_app_user()) already reads
-- public.users.role, which is the enum user_role ('ADMIN','MANAGER','USER').
-- This made public.users the correct single source of truth; profiles was the
-- drifted one. Repointing the hook to users.role removes the drift instead of
-- patching profiles' constraint, which would have kept two separate sources
-- in sync by convention rather than by design.
--
-- Verified before applying (on production, 2026-07-06): all current rows in
-- both users and profiles are role='ADMIN', so this was a no-op for every
-- existing session. The only behavior change is for a future MANAGER user, who
-- will now correctly resolve as MANAGER at login instead of silently falling
-- back to USER; and for any inactive/disabled user in `users`, who will now
-- fall back to 'USER' instead of carrying a stale role claim.
--
-- Applied to production (nnggcnpcuomwfuupupwg) via Supabase MCP apply_migration
-- as version 20260706014138. See docs/GOVERNANCE_LOG.md for sign-off record.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  claims    jsonb;
  user_role text;
BEGIN
  SELECT role::text
    INTO user_role
    FROM public.users
   WHERE id = (event->>'user_id')::uuid
     AND status = 'ACTIVE';

  claims := event -> 'claims';

  IF jsonb_typeof(claims -> 'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  END IF;

  claims := jsonb_set(
    claims,
    '{app_metadata, user_role}',
    to_jsonb(COALESCE(user_role, 'USER'))
  );

  RETURN jsonb_set(event, '{claims}', claims);
END;
$function$;
