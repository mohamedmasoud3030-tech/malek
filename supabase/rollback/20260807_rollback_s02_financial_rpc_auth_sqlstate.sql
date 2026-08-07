-- Rollback for 20260807011000_s02_financial_rpc_auth_sqlstate.sql.
--
-- Restores the previous generic exception code while preserving the rejecting
-- authentication guard, SECURITY DEFINER posture, pinned search_path and ACL.
begin;

do $$
declare
  v_signature constant text := 'public.record_invoice_payment_atomic(jsonb)';
  v_oid oid;
  v_definition text;
  v_rollback_definition text;
  v_old_guard constant text :=
    'RAISE EXCEPTION ''Authentication is required to record invoice payments'';';
  v_new_guard constant text :=
    'RAISE EXCEPTION ''Authentication is required to record invoice payments'' USING ERRCODE = ''42501'';';
begin
  v_oid := to_regprocedure(v_signature);
  if v_oid is null then
    raise exception 'S02-T06 auth SQLSTATE rollback aborted: missing %', v_signature;
  end if;

  select pg_get_functiondef(v_oid)
    into v_definition;

  if position(v_old_guard in v_definition) > 0 then
    v_rollback_definition := v_definition;
  else
    v_rollback_definition := replace(v_definition, v_new_guard, v_old_guard);
    if v_rollback_definition = v_definition then
      raise exception
        'S02-T06 auth SQLSTATE rollback aborted: expected hardened guard was not found in %',
        v_signature;
    end if;

    execute v_rollback_definition;
  end if;

  if not (
    select p.prosecdef
    from pg_proc p
    where p.oid = to_regprocedure(v_signature)
  ) then
    raise exception 'S02-T06 auth SQLSTATE rollback aborted: % lost SECURITY DEFINER', v_signature;
  end if;
end $$;

revoke all on function public.record_invoice_payment_atomic(jsonb)
  from public, anon, authenticated;
grant execute on function public.record_invoice_payment_atomic(jsonb)
  to authenticated, service_role;

commit;
