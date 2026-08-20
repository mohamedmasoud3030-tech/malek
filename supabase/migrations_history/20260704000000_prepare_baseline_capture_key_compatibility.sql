-- Prepare live-capture scaffolding for both supported identifier layouts.
--
-- The historical live snapshot used text contract identifiers while the
-- code-first baseline uses UUIDs. Batch A later uses CREATE TABLE IF NOT EXISTS,
-- so create deposit_txs here with a contract_id type derived from contracts(id).

DO $$
DECLARE
  v_contract_id_type text;
  v_deposit_contract_id_type text;
BEGIN
  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_contract_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'contracts'
    AND attribute.attname = 'id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_contract_id_type NOT IN ('uuid', 'text') THEN
    RAISE EXCEPTION 'Unsupported public.contracts(id) type: %', v_contract_id_type;
  END IF;

  IF to_regclass('public.deposit_txs') IS NULL THEN
    EXECUTE format(
      $sql$
        CREATE TABLE public.deposit_txs (
          id text NOT NULL PRIMARY KEY,
          contract_id %s REFERENCES public.contracts(id),
          type text,
          amount numeric,
          date text,
          notes text,
          created_at timestamptz,
          note text,
          updated_at timestamptz DEFAULT now(),
          deleted_at timestamptz,
          CONSTRAINT deposit_txs_amount_non_negative_chk
            CHECK ((amount IS NULL) OR (amount >= 0::numeric)) NOT VALID
        )
      $sql$,
      v_contract_id_type
    );
  END IF;

  SELECT format_type(attribute.atttypid, attribute.atttypmod)
    INTO v_deposit_contract_id_type
  FROM pg_attribute AS attribute
  JOIN pg_class AS relation ON relation.oid = attribute.attrelid
  JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'deposit_txs'
    AND attribute.attname = 'contract_id'
    AND attribute.attnum > 0
    AND NOT attribute.attisdropped;

  IF v_deposit_contract_id_type <> v_contract_id_type THEN
    RAISE EXCEPTION
      'contracts.id type % differs from deposit_txs.contract_id type %',
      v_contract_id_type,
      v_deposit_contract_id_type;
  END IF;
END
$$;
