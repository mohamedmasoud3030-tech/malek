-- S02-T06 follow-up — normalize the unauthenticated payment guard to 42501.
--
-- The RPC already rejected calls without auth.uid(), but its bare RAISE used
-- PostgreSQL's default P0001. The S02 security contract requires the explicit
-- insufficient_privilege SQLSTATE used by the other financial authorization
-- guards. Patch only the exact guard while preserving the complete function
-- body, SECURITY DEFINER flag, pinned search_path and existing ACL.
begin;

do $$
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
    raise exception 'S02-T06 auth SQLSTATE repair aborted: missing %', v_signature;
  end if;

  select pg_get_functiondef(v_oid)
    into v_definition;

  if position(v_new_guard in v_definition) > 0 then
    v_hardened_definition := v_definition;
  else
    v_hardened_definition := replace(v_definition, v_old_guard, v_new_guard);
    if v_hardened_definition = v_definition then
      raise exception
        'S02-T06 auth SQLSTATE repair aborted: expected authentication guard was not found in %',
        v_signature;
    end if;

    execute v_hardened_definition;
  end if;

  select pg_get_functiondef(to_regprocedure(v_signature))
    into v_definition;

  if position(v_new_guard in v_definition) = 0 then
    raise exception
      'S02-T06 auth SQLSTATE repair aborted: % does not expose SQLSTATE 42501 for missing authentication',
      v_signature;
  end if;

  if not (
    select p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure(v_signature)
  ) then
    raise exception 'S02-T06 auth SQLSTATE repair aborted: % lost SECURITY DEFINER', v_signature;
  end if;
end $$;

revoke all on function public.record_invoice_payment_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_invoice_payment_atomic(jsonb)
  to authenticated, service_role;

commit;
