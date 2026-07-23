CREATE OR REPLACE FUNCTION public.create_owner_agreement_atomic(payload jsonb)
 RETURNS owner_agreements
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company_id uuid;
  v_row public.owner_agreements%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يحتاج هذا الإجراء صلاحية مدير أو مشرف.';
  END IF;

  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;

  INSERT INTO public.owner_agreements (owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, ends_on, notes, company_id)
  VALUES (
    (payload->>'owner_id')::uuid,
    payload->>'property_id',
    payload->>'agreement_type',
    payload->>'commission_type',
    (payload->>'commission_value')::numeric,
    (payload->>'starts_on')::date,
    NULLIF(payload->>'ends_on', '')::date,
    NULLIF(payload->>'notes', '')
  , v_company_id)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$
;
