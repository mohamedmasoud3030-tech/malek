-- FIN-008/013/016/018/019. Preserve settled entitlement and separately expose
-- original cash, including an explicit incomplete-evidence state. No backfill.
begin;
do $position$
declare d text; r record;
begin
 for r in select * from (values
  ($old$  v_paid_net numeric := 0;$old$,
   $new$  v_paid_net numeric := 0;
  v_paid_cash numeric := 0;
  v_missing_cash bigint := 0;$new$),
  ($old$  v_remaining := public._r3(v_settled_net);$old$,
   $new$  -- Lifetime cash is independent of period economics and of the current
  -- offset header. Materialize the shared proof once per paid settlement.
  with evidence as materialized (
    select app_private.owner_settlement_paid_cash(v_company_id,s.id) as cash
    from public.owner_settlements s where s.company_id=v_company_id
      and s.owner_id::text=p_owner_id::text and s.status='PAID'
  )
  select coalesce(sum(cash),0),count(*) filter(where cash is null)
  into v_paid_cash,v_missing_cash from evidence;
  v_remaining := public._r3(v_settled_net);$new$),
  ($old$      'paid_net', public._r3(v_paid_net),$old$,
   $new$      'paid_net', public._r3(v_paid_net),
      'paid_cash', case when v_missing_cash=0 then public._r3(v_paid_cash) else null end,
      'paid_cash_proven_total', public._r3(v_paid_cash),
      'paid_cash_evidence_missing_count', v_missing_cash,$new$)
 ) x(needle,replacement) loop
  d:=pg_get_functiondef('public.rpt_owner_financial_position(uuid,date,date)'::regprocedure);
  if (length(d)-length(replace(d,r.needle,'')))/length(r.needle)<>1 then
   raise exception 'OWNER_POSITION_CASH_PRECONDITION';
  end if;
  execute replace(d,r.needle,r.replacement);
 end loop;
end; $position$;
notify pgrst,'reload schema';
commit;
