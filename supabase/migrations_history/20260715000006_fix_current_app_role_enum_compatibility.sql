-- Keep authorization role resolution compatible with both the historical text
-- column and the canonical public.user_role enum used by clean replays.
--
-- The function contract remains text so existing RLS helpers and RPC guards do
-- not change behavior. Only the database fallback value is normalized to text
-- before COALESCE, avoiding text/user_role type resolution failures.

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    nullif(auth.jwt() -> 'app_metadata' ->> 'user_role', ''),
    nullif(auth.jwt() -> 'app_metadata' ->> 'role', ''),
    (
      SELECT app_user.role::text
      FROM public.users AS app_user
      WHERE app_user.id = auth.uid()
        AND app_user.deleted_at IS NULL
        AND app_user.is_active
    ),
    'USER'::text
  )
$$;

ALTER FUNCTION public.current_app_role() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.current_app_role() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO service_role;
