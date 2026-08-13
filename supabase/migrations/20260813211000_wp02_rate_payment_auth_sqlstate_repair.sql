-- WP-02 / GAP-006 regression repair: preserve the hardened authorization
-- contract after 20260813170000_wp02_rate_fee_collection_wiring.sql replaced
-- record_invoice_payment_atomic. The RATE wiring retained the unauthenticated
-- rejection but accidentally restored PostgreSQL's generic P0001 SQLSTATE.
--
-- Patch only the exact guard to restore insufficient_privilege (42501), while
-- preserving the complete RATE implementation, SECURITY DEFINER flag, pinned
-- search_path and approved ACL. This repair intentionally survives a GAP-007
-- rollback because reintroducing the weaker SQLSTATE contract is not safe.

begin;

do $rate_auth_sqlstate_repair$
declare
  v_signature constant text := 'public.record_invoice_payment_atomic(jsonb)';
  v_oid oid;
  v_definition text;
  v_hardened_definition text;
  v_old_guard constant text :=
    'RAISE EXCEPTION ''Authentication is required to record invoice payments'';';
  v_new_guard constant text :=
    'RAISE EXCEPTION ''Authentication is required to record invoice payments'' USING ERRCODE = ''42501'';';
begin
  v_oid := to_regprocedure(v_signature);
  if v_oid is null then
    raise exception 'WP02_RATE_AUTH_SQLSTATE_REPAIR_ABORTED: missing %', v_signature;
  end if;

  select pg_get_functiondef(v_oid)
    into v_definition;

  if position(v_new_guard in v_definition) = 0 then
    v_hardened_definition := replace(v_definition, v_old_guard, v_new_guard);
    if v_hardened_definition = v_definition then
      raise exception
        'WP02_RATE_AUTH_SQLSTATE_REPAIR_ABORTED: expected authentication guard was not found in %',
        v_signature;
    end if;

    execute v_hardened_definition;
  end if;

  select pg_get_functiondef(to_regprocedure(v_signature))
    into v_definition;

  if position(v_new_guard in v_definition) = 0 then
    raise exception
      'WP02_RATE_AUTH_SQLSTATE_REPAIR_ABORTED: % does not expose SQLSTATE 42501 for missing authentication',
      v_signature;
  end if;

  if not (
    select p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure(v_signature)
  ) then
    raise exception 'WP02_RATE_AUTH_SQLSTATE_REPAIR_ABORTED: % lost SECURITY DEFINER', v_signature;
  end if;
end;
$rate_auth_sqlstate_repair$;

revoke all on function public.record_invoice_payment_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_invoice_payment_atomic(jsonb)
  to authenticated, service_role;

commit;
