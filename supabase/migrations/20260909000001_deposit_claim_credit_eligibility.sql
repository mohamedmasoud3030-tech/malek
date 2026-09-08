-- FIN-004/FIN-009: deposit applications must not settle already credited AR.
-- Reproduced with the real browser service -> replayed RPC -> persisted credit:
-- after an 800 credit on a 1000 invoice, a 300 claim was still accepted.
-- Apply-time eligibility had the same omitted-credit expression.
-- Preserve function bodies, ownership, grants, locks, maker-checker, company
-- scope, posting and owner-funds lineage. Fail the migration if the expected
-- repository body is absent rather than guessing at a deployed definition.
-- No historical balance/data rewrite. This file is not authorization to deploy.

begin;

do $deposit_credit_eligibility$
declare
  signature text;
  definition text;
  patched text;
  old_amount text;
  new_amount text;
begin
  foreach signature in array array[
    'public.create_deposit_application_claim_atomic(jsonb)',
    'public.apply_deposit_claim_atomic(jsonb)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'DEPOSIT_CREDIT_PATCH_MISSING_FUNCTION: %', signature;
    end if;
    definition := pg_get_functiondef(to_regprocedure(signature));
    if signature like '%create_deposit%' then
      old_amount := 'coalesce(i.amount,0) + coalesce(i.tax_amount,0) - coalesce(i.paid_amount,0)';
      new_amount := old_amount || ' - coalesce(i.credited_amount,0)';
    else
      old_amount := 'coalesce(i.amount,0)+coalesce(i.tax_amount,0)-coalesce(i.paid_amount,0)';
      new_amount := old_amount || '-coalesce(i.credited_amount,0)';
    end if;
    if position(new_amount in definition) > 0 then
      continue;
    end if;
    if position(old_amount in definition) = 0 then
      raise exception 'DEPOSIT_CREDIT_PATCH_UNEXPECTED_BODY: %', signature;
    end if;
    patched := replace(definition, old_amount, new_amount);
    execute patched;
  end loop;
end;
$deposit_credit_eligibility$;

commit;
