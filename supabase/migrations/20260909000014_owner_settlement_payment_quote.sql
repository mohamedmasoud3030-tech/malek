-- FIN-008/013/016/018/019; SEC-001/002; GAP-008.
-- Quote the existing payable source, never accept a client amount override.
begin;
create function app_private.owner_settlement_payment_quote(p_company uuid,p_id text)
returns jsonb language sql stable set search_path to 'public','pg_temp' as $$
 select jsonb_build_object('settlement_id',s.id,'status',s.status,
   'net_payable',s.net_payable,'offset_applied',s.offset_applied,
   'effective_payable',public.wp02_gap008_round_omr(s.net_payable-s.offset_applied),
   'quote',encode(sha256(convert_to(jsonb_build_object(
     'id',s.id,'company_id',s.company_id,'owner_id',s.owner_id,'property_id',s.property_id,
     'period_start',s.period_start,'period_end',s.period_end,'status',s.status,
     'gross_collected',s.gross_collected,'office_fee',s.office_fee,'owner_expenses',s.owner_expenses,
     'tax_amount',s.tax_amount,'net_payable',s.net_payable,'offset_applied',s.offset_applied,
     'approved_at',s.approved_at,'approved_by',s.approved_by)::text,'UTF8')),'hex'))
 from public.owner_settlements s where s.company_id=p_company and s.id::text=p_id;
$$;
revoke all on function app_private.owner_settlement_payment_quote(uuid,text) from public,anon,authenticated;

create function public.preview_owner_settlement_payment(p_settlement_id text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare v_company uuid; s public.owner_settlements%rowtype; q jsonb;
begin
 if auth.uid() is null or not public.is_admin_or_manager()
   or not public.current_user_has_effective_app_permission('financial.owner_settlements.pay') then
  raise exception 'OWNER_SETTLEMENT_PAYMENT_PERMISSION_REQUIRED' using errcode='42501';
 end if;
 v_company:=public.require_company_id();
 select * into s from public.owner_settlements where company_id=v_company and id::text=p_settlement_id for update;
 if not found then raise exception 'OWNER_SETTLEMENT_NOT_FOUND_OR_FORBIDDEN' using errcode='42501'; end if;
 if s.status<>'APPROVED' then raise exception 'OWNER_SETTLEMENT_PAYMENT_REQUIRES_APPROVED' using errcode='22023'; end if;
 perform public.assert_owner_settlement_totals_fresh(p_settlement_id);
 perform app_private.require_allocated_expense_settlement_scope(v_company,s.owner_id::uuid,s.period_start,s.period_end,s.property_id::text);
 q:=app_private.owner_settlement_payment_quote(v_company,p_settlement_id);
 if (q->>'effective_payable')::numeric<0 then raise exception 'OWNER_SETTLEMENT_EFFECTIVE_PAYABLE_NEGATIVE' using errcode='23514'; end if;
 return q;
end; $$;
revoke all on function public.preview_owner_settlement_payment(text) from public,anon;
grant execute on function public.preview_owner_settlement_payment(text) to authenticated,service_role;

do $payment$
declare d text; r record;
begin
 for r in select * from (values
 ($old$  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;$old$,
  $new$  if not public.current_user_has_effective_app_permission('financial.owner_settlements.pay') then
    raise exception 'OWNER_SETTLEMENT_PAYMENT_PERMISSION_REQUIRED' using errcode='42501';
  end if;
  v_company_id := (auth.jwt() -> 'app_metadata' ->> 'company_id')::uuid;$new$),
 ($old$  v_request_fingerprint := encode(sha256(convert_to(jsonb_build_object(
    'settlement_id', v_id,
    'method', v_method,
    'payment_reference', v_reference
  )::text, 'UTF8')), 'hex');$old$,
  $new$  v_request_fingerprint := encode(sha256(convert_to((jsonb_build_object(
    'settlement_id', v_id,
    'method', v_method,
    'payment_reference', v_reference
  ) || case when p_payload ? 'expected_quote' then jsonb_build_object('expected_quote',p_payload->>'expected_quote') else '{}'::jsonb end)::text, 'UTF8')), 'hex');$new$),
 ($old$  -- ── FA-003: the paid settlement must own exactly its fully-reserved items and$old$,
  $new$  -- Compare only after the existing cache replay and under the settlement
  -- row lock. Legacy unquoted retries retain their original fingerprint shape.
  if p_payload ? 'expected_quote' and (p_payload->>'expected_quote') is distinct from
    (app_private.owner_settlement_payment_quote(v_company_id,v_id)->>'quote') then
    raise exception 'OWNER_SETTLEMENT_PAYMENT_QUOTE_CHANGED: refresh the payment preview before confirming.' using errcode='23514';
  end if;
  -- ── FA-003: the paid settlement must own exactly its fully-reserved items and$new$)
 ) x(needle,replacement) loop
  d:=pg_get_functiondef('public.pay_owner_settlement_atomic_s02_base(jsonb)'::regprocedure);
  if (length(d)-length(replace(d,r.needle,'')))/length(r.needle)<>1 then raise exception 'OWNER_PAYMENT_QUOTE_PRECONDITION'; end if;
  execute replace(d,r.needle,r.replacement);
 end loop;
end; $payment$;
-- Pending cash is not the pre-offset entitlement. Preserve the separate
-- historical entitlement aggregate; do not fabricate historical paid cash.
do $pending$
declare d text; old_text text:=$s$sum(s.net_payable) filter (where upper(coalesce(s.status, '')) in ('DRAFT', 'APPROVED'))$s$;
begin
 d:=pg_get_functiondef('public.rpt_owner_financial_position(uuid,date,date)'::regprocedure);
 if (length(d)-length(replace(d,old_text,'')))/length(old_text)<>1 then raise exception 'OWNER_PAYMENT_PENDING_PRECONDITION'; end if;
 execute replace(d,old_text,replace(old_text,'sum(s.net_payable)','sum(s.net_payable-s.offset_applied)'));
end; $pending$;
notify pgrst,'reload schema';
commit;
