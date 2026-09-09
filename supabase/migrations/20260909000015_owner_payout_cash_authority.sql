-- FIN-008/013/016/018/019; SEC-001/002. Read original cash evidence, not
-- entitlement or a historical offset header which could once be changed.
begin;
create function app_private.owner_settlement_paid_cash(p_company uuid,p_settlement text)
returns numeric language plpgsql stable set search_path to 'public','pg_temp' as $$
declare b public.journal_batches%rowtype; cash numeric; payable numeric; valid boolean;
begin
 if not exists(select 1 from public.owner_settlements s where s.company_id=p_company
   and s.id=p_settlement and s.status='PAID') then return null; end if;
 select * into b from public.journal_batches where company_id=p_company
   and source_type='owner_settlement_payment' and source_id=p_settlement and event_id='pay';
 if not found then
  -- Absence of a journal alone is NOT proof of zero cash. The persisted
  -- payment acknowledgement can prove a lawful, fully-offset closure.
  if exists(select 1 from public.financial_operation_idempotency f
    where f.operation_name='pay_owner_settlement_atomic:'||p_company::text
      and f.response_payload->'response' @> jsonb_build_object('success',true,'status','PAID',
        'settlement_id',p_settlement,'effective_payable',0,'journal_batch_id',null)
      and f.response_payload#>'{response,net_payable}' = f.response_payload#>'{response,offset_applied}') then
   return 0;
  end if;
  return null;
 end if;
 -- A later compensating reversal does not erase the original bank outflow.
 -- Its inflow is a distinct event; never net it against this historical payment.
 if b.status not in ('POSTED','REVERSED') or b.reversal_of_batch_id is not null then return null; end if;
 select sum(case when a.no in ('1111','1120') then l.credit-l.debit else 0 end),
   sum(case when a.no='2000' then l.debit-l.credit else 0 end),
   bool_and(l.company_id=p_company and a.company_id=p_company and
     ((a.no='2000' and l.credit=0 and l.debit>=0) or
      (a.no in ('1111','1120') and l.debit=0 and l.credit>=0)))
 into cash,payable,valid
 from public.journal_lines l join public.accounts a on a.id=l.account_id
 where l.batch_id=b.id and l.deleted_at is null;
 if valid and cash>0 and cash=payable and cash=round(cash,3) then return cash; end if;
 return null;
end; $$;
revoke all on function app_private.owner_settlement_paid_cash(uuid,text) from public,anon,authenticated;

-- Bounded read for bank suggestions. Unknown/malformed history remains NULL,
-- never silently changed to zero or reconstructed from the current header.
create function public.get_owner_settlement_cash_payments(p_settlement_ids text[])
returns jsonb language plpgsql stable security definer set search_path to 'public','pg_temp' as $$
declare company uuid; requested integer; result jsonb;
begin
 if auth.uid() is null or not public.current_user_has_effective_app_permission('financial.bank_reconciliation.view') then
  raise exception 'OWNER_PAYOUT_CASH_PERMISSION_REQUIRED' using errcode='42501';
 end if;
 company:=public.require_company_id();
 if p_settlement_ids is null or cardinality(p_settlement_ids)>200 then
  raise exception 'OWNER_PAYOUT_CASH_BATCH_INVALID' using errcode='22023';
 end if;
 select count(distinct id) into requested from unnest(p_settlement_ids) id;
 if array_position(p_settlement_ids,null) is not null then
  raise exception 'OWNER_PAYOUT_CASH_BATCH_INVALID' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('settlement_id',s.id,
   'cash_paid',app_private.owner_settlement_paid_cash(company,s.id)) order by s.id),'[]'::jsonb)
 into result from public.owner_settlements s where s.company_id=company and s.status='PAID' and s.id=any(p_settlement_ids);
 if jsonb_array_length(result)<>requested then
  raise exception 'OWNER_PAYOUT_CASH_NOT_FOUND_OR_FORBIDDEN' using errcode='42501';
 end if;
 return result;
end; $$;
revoke all on function public.get_owner_settlement_cash_payments(text[]) from public,anon;
grant execute on function public.get_owner_settlement_cash_payments(text[]) to authenticated,service_role;

-- Repair the existing match authority; leave all old matches and GL intact.
do $match$
declare d text; r record;
begin
 for r in select * from (values
  ($old$    select s.net_payable, s.company_id, s.status into v_entity_amount, v_entity_company_id, v_entity_status$old$,
   $new$    select app_private.owner_settlement_paid_cash(v_company_id,s.id), s.company_id, s.status into v_entity_amount, v_entity_company_id, v_entity_status$new$),
  ($old$      raise exception 'Owner payout must be PAID to be reconciled.' using errcode = '23514';
    end if;$old$,
   $new$      raise exception 'Owner payout must be PAID to be reconciled.' using errcode = '23514';
    end if;
    if v_entity_amount is null or v_entity_amount<=0 then
      raise exception 'OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED: no proven positive cash payment.' using errcode='23514';
    end if;$new$)
 ) x(needle,replacement) loop
  d:=pg_get_functiondef('public.process_bank_reconciliation_match_atomic(jsonb)'::regprocedure);
  if (length(d)-length(replace(d,r.needle,'')))/length(r.needle)<>1 then
   raise exception 'OWNER_PAYOUT_CASH_MATCH_PRECONDITION';
  end if;
  execute replace(d,r.needle,r.replacement);
 end loop;
end; $match$;
notify pgrst,'reload schema';
commit;
