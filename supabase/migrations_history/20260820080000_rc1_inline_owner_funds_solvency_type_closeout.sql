-- ============================================================================
-- RC1 schema/type-drift closeout
-- ============================================================================
-- 00700 introduced a helper function solely to keep the owner-funds solvency
-- guard readable. The generated database contract correctly reported that new
-- public function as schema drift. Keep the invariant while minimizing the
-- final public schema surface: inline the solvency checks in the existing
-- trigger function and remove the helper in this forward migration.
--
-- No posted financial history or operational source row is rewritten.
-- ============================================================================

begin;

create or replace function public.guard_owner_funds_event_cutover()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_gl_2000 numeric;
  v_invoice_position numeric;
begin
  -- Preserve the cutover gate introduced by 00600.
  perform public.assert_owner_funds_event_cutover(
    new.company_id,
    new.effective_date,
    new.journal_batch_id
  );

  -- 2000 is Owner Funds Payable. A debit balance is never silently converted
  -- into an owner receivable; an approved 1300 path must be used instead.
  -- Business RPCs post the matching canonical journal batch before appending
  -- owner_funds_events in the same transaction, so this read includes the
  -- proposed GL effect and the transaction aborts atomically on failure.
  v_gl_2000 := public.wp05_gl_balance(
    new.company_id,
    '2000',
    new.effective_date
  );

  if v_gl_2000 < -0.001 then
    raise exception 'OWNER_FUNDS_CONTROL_NEGATIVE: account 2000 would become a debit balance %. Use 1300 for an approved owner receivable instead.', v_gl_2000
      using errcode='23514';
  end if;

  -- A RATE management fee may only consume owner funds attributable to the
  -- same invoice. This prevents a high fee/tax combination from borrowing an
  -- unrelated owner's payable balance to hide an owner receivable.
  if new.source_type = 'MANAGEMENT_FEE'
     and new.invoice_id is not null
     and new.amount_delta < 0 then
    select public.wp05_round_omr(
      coalesce(sum(e.amount_delta),0) + new.amount_delta
    )
      into v_invoice_position
      from public.owner_funds_events e
     where e.company_id = new.company_id
       and e.invoice_id = new.invoice_id
       and e.effective_date <= new.effective_date;

    if coalesce(v_invoice_position,0) < -0.001 then
      raise exception 'OWNER_FUNDS_INVOICE_BALANCE_INSUFFICIENT_FOR_FEE: fee gross exceeds owner funds attributable to this invoice.'
        using errcode='23514';
    end if;
  end if;

  return new;
end;
$function$;

alter function public.guard_owner_funds_event_cutover() owner to postgres;
revoke all on function public.guard_owner_funds_event_cutover() from public, anon, authenticated;

comment on function public.guard_owner_funds_event_cutover() is
  'RC1 owner-funds insert guard: enforces S08 cutover, non-debit 2000 control and invoice-specific management-fee solvency.';

-- The helper was introduced in 00700 and has no externally supported contract.
-- Removing it returns the final generated RPC surface to the committed contract
-- while retaining the exact invariant inside the trigger authority above.
drop function if exists public.assert_owner_funds_event_solvency(uuid,uuid,text,numeric,date);

commit;
