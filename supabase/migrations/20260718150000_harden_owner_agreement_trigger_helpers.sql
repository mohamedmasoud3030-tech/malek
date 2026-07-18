-- Trigger helper functions execute through database triggers and are not public RPCs.
-- Revoke direct API execution while preserving trigger behavior and a fixed search_path.

ALTER FUNCTION public.assert_owner_agreement_covers_linked_contracts()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.assert_property_owner_temporal_integrity()
  SET search_path = public, pg_temp;
ALTER FUNCTION public.set_owner_agreements_updated_at()
  SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.assert_owner_agreement_covers_linked_contracts()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_property_owner_temporal_integrity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_owner_agreements_updated_at()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.assert_owner_agreement_covers_linked_contracts()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_property_owner_temporal_integrity()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.set_owner_agreements_updated_at()
  TO service_role;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.assert_owner_agreement_covers_linked_contracts()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.assert_owner_agreement_covers_linked_contracts()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.assert_property_owner_temporal_integrity()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.assert_property_owner_temporal_integrity()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.set_owner_agreements_updated_at()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.set_owner_agreements_updated_at()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Owner agreement trigger helpers remain directly executable by API roles';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_owner_agreement_covers_linked_contracts() IS
  'Internal trigger helper. Direct API execution is revoked.';
COMMENT ON FUNCTION public.assert_property_owner_temporal_integrity() IS
  'Internal trigger helper. Direct API execution is revoked.';
COMMENT ON FUNCTION public.set_owner_agreements_updated_at() IS
  'Internal trigger helper. Direct API execution is revoked.';

NOTIFY pgrst, 'reload schema';
