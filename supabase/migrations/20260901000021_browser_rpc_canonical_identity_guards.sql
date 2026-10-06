-- Add the smallest fail-closed canonical identity/role guard to browser
-- orchestration wrappers that currently delegate authorization or only check
-- auth.uid()/company context.
--
-- Existing successful authorized callers are preserved:
--   * settlement approve/pay wrappers already delegate to *_s02_base which
--     requires is_admin_or_manager(); the wrapper now states that same gate.
--   * property/agreement wrappers already delegate to helpers that require
--     is_admin_or_manager().
--   * set_sole_admin_self_approval_atomic already requires an active ADMIN
--     company_members row; is_admin() is the canonical equivalent.
--   * create_maintenance_atomic currently allows any authenticated company
--     member; is_app_user() is that same fail-closed identity check.
--   * create_deposit / create_future version currently require company
--     context only; is_app_user() is the least restrictive accepted resolver.
--
-- Function signatures, grants, search_path, and business calculations are
-- unchanged.

begin;

do $patch_browser_rpc_guards$
declare
  rec record;
  def text;
  marker text;
  inserted text;
  begin_at integer;
begin
  for rec in
    select *
    from (
      values
        ('public.approve_owner_settlement_atomic(jsonb)', 'is_admin_or_manager'),
        ('public.pay_owner_settlement_atomic(jsonb)', 'is_admin_or_manager'),
        ('public.create_owner_agreement_with_version_atomic(jsonb)', 'is_admin_or_manager'),
        ('public.create_property_with_versioned_agreement_atomic(text,text,text,uuid,text,text,numeric,date,date,text,numeric,numeric,text,text,text)', 'is_admin_or_manager'),
        ('public.create_future_owner_agreement_version_atomic(uuid,jsonb)', 'is_admin_or_manager'),
        ('public.set_sole_admin_self_approval_atomic(jsonb)', 'is_admin'),
        ('public.create_maintenance_atomic(text,text,text,text,text,text,text,date,text,text,uuid,uuid)', 'is_app_user'),
        ('public.create_deposit_application_claim_with_inspection_atomic(jsonb)', 'is_app_user')
    ) as t(signature, resolver)
  loop
    if to_regprocedure(rec.signature) is null then
      raise exception 'BROWSER_RPC_GUARD_ABORT: missing %', rec.signature;
    end if;

    def := pg_get_functiondef(to_regprocedure(rec.signature));
    marker := rec.resolver || '(';
    if position(marker in def) > 0 then
      continue;
    end if;

    inserted := format(
      E'\n  if not coalesce(public.%s(), false) then\n    raise exception ''APP_AUTHORITY_REQUIRED'' using errcode = ''42501'';\n  end if;\n',
      rec.resolver
    );

    begin_at := position(E'\nbegin\n' in def);
    if begin_at = 0 then
      begin_at := position(E'\nBEGIN\n' in def);
    end if;
    if begin_at = 0 then
      raise exception 'BROWSER_RPC_GUARD_ABORT: could not find begin in %', rec.signature;
    end if;

    def := overlay(def placing inserted from begin_at + 7 for 0);
    execute def;

    if position(marker in pg_get_functiondef(to_regprocedure(rec.signature))) = 0 then
      raise exception 'BROWSER_RPC_GUARD_ABORT: failed to insert % into %', rec.resolver, rec.signature;
    end if;
  end loop;
end
$patch_browser_rpc_guards$;

commit;
