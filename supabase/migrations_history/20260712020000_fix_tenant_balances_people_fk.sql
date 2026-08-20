-- =============================================================================
-- Migration: Fix tenant_balances foreign key to reference people(id)
-- Retargets public.tenant_balances.tenant_id from legacy public.tenants(id)
-- to canonical public.people(id), while preserving both supported identifier
-- layouts used by historical production (text) and the clean baseline (uuid).
-- =============================================================================

DO $$
DECLARE
  v_people_id_type text;
  v_tenant_id_type text;
  v_resulting_tenant_id_type text;
  v_orphan_count bigint;
BEGIN
  IF to_regclass('public.people') IS NULL THEN
    RAISE EXCEPTION 'Cannot migrate tenant balances: public.people was not found';
  END IF;

  IF to_regclass('public.tenant_balances') IS NULL THEN
    RAISE EXCEPTION 'Cannot migrate tenant balances: public.tenant_balances was not found';
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_people_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'people'
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_tenant_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'tenant_balances'
    AND attribute.attname = 'tenant_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_people_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot migrate tenant balances: public.people(id) was not found';
  END IF;

  IF v_tenant_id_type IS NULL THEN
    RAISE EXCEPTION 'Cannot migrate tenant balances: public.tenant_balances(tenant_id) was not found';
  END IF;

  IF v_people_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot migrate tenant balances: unsupported public.people(id) type %',
      v_people_id_type;
  END IF;

  IF v_tenant_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot migrate tenant balances: unsupported public.tenant_balances(tenant_id) type %',
      v_tenant_id_type;
  END IF;

  SELECT count(*)
    INTO v_orphan_count
  FROM public.tenant_balances AS tenant_balance
  LEFT JOIN public.people AS person
    ON person.id::text = tenant_balance.tenant_id::text
  WHERE person.id IS NULL;

  IF v_orphan_count > 0 THEN
    RAISE EXCEPTION
      'Cannot apply migration: found % orphan row(s) in public.tenant_balances where tenant_id does not exist in public.people. Manual reconciliation required.',
      v_orphan_count;
  END IF;

  EXECUTE 'ALTER TABLE public.tenant_balances DROP CONSTRAINT IF EXISTS tenant_balances_tenant_fk';
  EXECUTE 'ALTER TABLE public.tenant_balances DROP CONSTRAINT IF EXISTS tenant_balances_tenant_id_people_fkey';

  IF v_tenant_id_type <> v_people_id_type THEN
    IF v_tenant_id_type = 'text' AND v_people_id_type = 'uuid' THEN
      EXECUTE 'ALTER TABLE public.tenant_balances ALTER COLUMN tenant_id TYPE uuid USING tenant_id::uuid';
    ELSIF v_tenant_id_type = 'uuid' AND v_people_id_type = 'text' THEN
      EXECUTE 'ALTER TABLE public.tenant_balances ALTER COLUMN tenant_id TYPE text USING tenant_id::text';
    ELSE
      RAISE EXCEPTION
        'Cannot migrate tenant balances: tenant_balances.tenant_id type % cannot be converted to people.id type %',
        v_tenant_id_type,
        v_people_id_type;
    END IF;
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_resulting_tenant_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation
    ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'tenant_balances'
    AND attribute.attname = 'tenant_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_resulting_tenant_id_type <> v_people_id_type THEN
    RAISE EXCEPTION
      'Cannot link tenant balances: tenant_balances.tenant_id type % differs from people.id type %',
      v_resulting_tenant_id_type,
      v_people_id_type;
  END IF;
END
$$;

ALTER TABLE public.tenant_balances
  ADD CONSTRAINT tenant_balances_tenant_id_people_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.people(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_tenant_balances_tenant_id
  ON public.tenant_balances (tenant_id);
