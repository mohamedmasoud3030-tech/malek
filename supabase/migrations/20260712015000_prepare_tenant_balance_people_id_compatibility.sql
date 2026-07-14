-- Prepare tenant_balances for the canonical people(id) foreign key.
--
-- The code-first baseline creates people.id as uuid, while the captured
-- historical tenant_balances table uses a text tenant_id. The following
-- 20260712020000 migration correctly retargets the foreign key to people,
-- but PostgreSQL cannot create that constraint until both columns use the
-- same type. Resolve only the supported uuid/text mismatch and fail closed
-- before changing the column when values cannot map to a canonical person.

DO $$
DECLARE
  v_people_id_type text;
  v_tenant_id_type text;
  v_invalid_count bigint;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_people_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'people'
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_tenant_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'tenant_balances'
    AND attribute.attname = 'tenant_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_people_id_type IS NULL OR v_tenant_id_type IS NULL THEN
    RAISE EXCEPTION
      'Cannot align tenant balances: people.id or tenant_balances.tenant_id was not found';
  END IF;

  IF v_people_id_type NOT IN ('uuid', 'text')
     OR v_tenant_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION
      'Cannot align tenant balances: unsupported people.id type % or tenant_balances.tenant_id type %',
      v_people_id_type,
      v_tenant_id_type;
  END IF;

  IF v_people_id_type = v_tenant_id_type THEN
    RETURN;
  END IF;

  IF v_people_id_type = 'uuid' THEN
    SELECT count(*)
      INTO v_invalid_count
    FROM public.tenant_balances
    WHERE tenant_id IS NOT NULL
      AND tenant_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

    IF v_invalid_count > 0 THEN
      RAISE EXCEPTION
        'Cannot align tenant balances: found % tenant_id value(s) that are not valid UUIDs',
        v_invalid_count;
    END IF;
  END IF;

  SELECT count(*)
    INTO v_invalid_count
  FROM public.tenant_balances AS tenant_balance
  LEFT JOIN public.people AS person
    ON person.id::text = tenant_balance.tenant_id::text
  WHERE person.id IS NULL;

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION
      'Cannot align tenant balances: found % tenant_id value(s) without a matching public.people row',
      v_invalid_count;
  END IF;

  ALTER TABLE public.tenant_balances
    DROP CONSTRAINT IF EXISTS tenant_balances_tenant_fk;

  IF v_people_id_type = 'uuid' THEN
    ALTER TABLE public.tenant_balances
      ALTER COLUMN tenant_id TYPE uuid USING tenant_id::text::uuid;
  ELSE
    ALTER TABLE public.tenant_balances
      ALTER COLUMN tenant_id TYPE text USING tenant_id::text;
  END IF;
END
$$;
