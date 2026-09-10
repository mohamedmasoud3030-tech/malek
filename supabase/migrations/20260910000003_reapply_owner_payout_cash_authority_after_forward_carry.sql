-- OPS-003 — re-apply the 20260909000015 owner-payout cash authority patches on
-- top of the 20260910000002 forward-carry.
--
-- WHY THIS EXISTS
-- 20260910000002 carries the RC1 hardening by running
--   create or replace function public.process_bank_reconciliation_match_atomic(jsonb)
-- with the body as it stands in 20260901000033. On the HOSTED database that was
-- correct and safe, because there 20260909000015 was applied AFTER the
-- forward-carry, so the hosted function currently holds both changes (verified:
-- owner_settlement_paid_cash present once, OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED
-- present once, zero legacy `select s.net_payable, s.company_id, s.status`, and
-- all 10 cross-company guards).
--
-- On a CLEAN REPLAY the order is filename order, so 20260910000002 runs AFTER
-- 20260909000015 and silently reverts it: the match authority goes back to
-- reading s.net_payable (the ENTITLEMENT) instead of
-- app_private.owner_settlement_paid_cash (PROVEN CASH), and loses the
-- OWNER_PAYOUT_CASH_EVIDENCE_REQUIRED guard. That is a real financial
-- correctness regression -- it would let a bank line be reconciled against an
-- owner payout that was never actually paid in cash, and it would let missing
-- historical evidence be treated as a matchable amount.
--
-- Caught by src/features/financials/reconciliation/owner-payout-cash-authority.test.ts
-- (3 failures on clean replay, 0 against the hosted database).
--
-- WHAT THIS DOES
-- Re-applies the two 20260909000015 needle/replacement patches, copied VERBATIM
-- by line range from that file so the two cannot drift. The block is naturally
-- self-checking: it aborts with OWNER_PAYOUT_CASH_MATCH_PRECONDITION unless each
-- needle occurs exactly once, so if the patch is somehow already present this
-- migration fails loudly rather than double-applying or silently passing.
--
-- Neither 20260909000015 nor 20260910000002 is edited: both are already applied
-- and merged, and rewriting a merged migration is the exact root cause of the
-- anchor-drift class this session spent its time repairing.
--
-- No table, no policy, no grant, no data touched. Function body only.

begin;

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
  -- Already satisfied? Then this specific patch was applied earlier (this is the
  -- state of the hosted database, where 20260909000015 ran AFTER the
  -- forward-carry). Skip it instead of aborting, so this migration is a true
  -- no-op there and a real repair on a clean replay.
  if (length(d)-length(replace(d,r.replacement,'')))/length(r.replacement)=1 then
   continue;
  end if;
  -- Not satisfied: the ORIGINAL needle must be present exactly once. Any other
  -- state is unrecognised and must abort loudly rather than be guessed at.
  if (length(d)-length(replace(d,r.needle,'')))/length(r.needle)<>1 then
   raise exception 'OWNER_PAYOUT_CASH_MATCH_PRECONDITION';
  end if;
  execute replace(d,r.needle,r.replacement);
 end loop;
end; $match$;

notify pgrst,'reload schema';

commit;
