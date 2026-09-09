-- FIN-012/013/016; truthful fixed-fee tax metadata, not new tax policy.
-- Existing posting kernels, amounts, authorization and historical rows remain
-- unchanged. Both read/orchestration summaries use the same source classifier.
begin;
create function app_private.fixed_fee_tax_history_status(
  p_company_id uuid,p_from date,p_to date,p_version_id uuid default null
) returns text
language plpgsql stable
set search_path to 'public','pg_temp'
as $function$
declare v_status text;
begin
  if p_company_id is null or p_from is null or p_to is null or p_from>p_to then
    raise exception 'FIXED_FEE_TAX_HISTORY_SCOPE_REQUIRED' using errcode='22023';
  end if;
  select case when count(*)=0 then 'NO_ACCRUALS'
    when bool_and(tax_authority_status='VERSIONED_FEE_TREATMENT') then 'VERSIONED_FEE_TREATMENT'
    else 'OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY' end into v_status
  from public.fixed_monthly_daily_accruals
  where company_id=p_company_id and accrual_date between p_from and p_to
    and (p_version_id is null or agreement_version_id=p_version_id);
  return v_status;
end;
$function$;
revoke all on function app_private.fixed_fee_tax_history_status(uuid,date,date,uuid) from public,anon,authenticated;
grant execute on function app_private.fixed_fee_tax_history_status(uuid,date,date,uuid) to authenticated,service_role;

-- Constrained metadata replacement preserves the complete existing function
-- bodies/attributes. Unexpected deployed definitions abort, never get guessed.
do $metadata$
declare
  v record;
  v_definition text;
  v_old constant text := '''tax_authority_status'', ''OUT_OF_SCOPE_NO_VERSIONED_AUTHORITY''';
begin
  for v in select * from (values
    ('public.list_fixed_monthly_accruals(jsonb)',
      '''tax_authority_status'', app_private.fixed_fee_tax_history_status(v_company_id,v_date_from,v_date_to)'),
    ('public.gl_run_fixed_monthly_accruals(uuid,date,date,uuid,uuid)',
      '''tax_authority_status'', app_private.fixed_fee_tax_history_status(p_company_id,p_date_from,p_date_to,p_agreement_version_id)')
  ) definitions(signature,replacement)
  loop
    v_definition := pg_get_functiondef(v.signature::regprocedure);
    if (length(v_definition)-length(replace(v_definition,v_old,'')))/length(v_old) <> 1 then
      raise exception 'FIXED_FEE_TAX_METADATA_PRECONDITION: expected exactly one metadata constant in %',v.signature;
    end if;
    execute replace(v_definition,v_old,v.replacement);
  end loop;
end;
$metadata$;
commit;
