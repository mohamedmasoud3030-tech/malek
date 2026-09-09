-- FIN-008/013/016/018/019; SEC-001/002; GAP-008.
-- Prospective write controls only. No historical amounts/events are rewritten.
begin;
do $repair$
declare r record; d text;
begin
 for r in select * from (values
 ('public.offset_owner_receivable_atomic(jsonb)',
  'v_amount > v_dfo.outstanding + 0.001', 'v_amount > v_dfo.outstanding'),
 ('public.offset_owner_receivable_atomic(jsonb)',
  'v_amount > public.wp02_gap008_round_omr(v_settlement.net_payable - v_settlement.offset_applied) + 0.001',
  'v_amount > public.wp02_gap008_round_omr(v_settlement.net_payable - v_settlement.offset_applied)'),
 ('public.guard_owner_funds_event_cutover()', 'v_gl_2000 < -0.001', 'v_gl_2000 < 0'),
 ('public.guard_owner_funds_event_cutover()', 'coalesce(v_invoice_position,0) < -0.001', 'coalesce(v_invoice_position,0) < 0'),
 ('public.cancel_owner_settlement_atomic(jsonb)',
  $old$  update public.owner_settlements
     set status = 'CANCELLED',$old$,
  $new$  if v_row.offset_applied <> 0 or exists (
    select 1 from public.due_from_owner_offsets o
    where o.company_id=v_company_id and o.owner_settlement_id=v_row.id::text and o.status='POSTED'
  ) then
    raise exception 'OWNER_SETTLEMENT_ACTIVE_OFFSETS_REVERSE_FIRST: reverse the active offset before releasing its approved settlement ordering.' using errcode='23514';
  end if;
  update public.owner_settlements
     set status = 'CANCELLED',$new$),
 ('public.reverse_owner_receivable_offset_atomic(jsonb)',
  '  v_rev := public.reverse_journal_batch(v_event.journal_batch_id);',
  $new$  -- Cached reversal acknowledgement above remains unchanged. For a new
  -- effect, use the same receivable -> settlement lock order as offset creation.
  perform 1 from public.due_from_owners d where d.id=v_event.due_from_owner_id
    and d.company_id=v_company_id and d.owner_id=v_event.owner_id for update;
  if not found then raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_SOURCE_FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.owner_settlements s where s.id::text=v_event.owner_settlement_id
    and s.company_id=v_company_id and s.owner_id::uuid=v_event.owner_id for update;
  if not found then raise exception 'DUE_FROM_OWNER_OFFSET_REVERSE_SETTLEMENT_FORBIDDEN' using errcode='42501'; end if;
  if exists(select 1 from public.owner_settlements s where s.id::text=v_event.owner_settlement_id
    and s.company_id=v_company_id and s.status='PAID') then
    raise exception 'OWNER_OFFSET_PAID_SETTLEMENT_REQUIRES_GOVERNED_ADJUSTMENT: the historical payout and offset cannot be rewritten by this command.' using errcode='23514';
  end if;
  v_rev := public.reverse_journal_batch(v_event.journal_batch_id);$new$)
 ) x(signature,needle,replacement) loop
  d:=pg_get_functiondef(r.signature::regprocedure);
  if (length(d)-length(replace(d,r.needle,'')))/length(r.needle)<>1 then
   raise exception 'OWNER_OFFSET_FINALITY_PRECONDITION: %',r.signature;
  end if;
  execute replace(d,r.needle,r.replacement);
 end loop;
end; $repair$;

-- A paid settlement is historical evidence, including the offset used to
-- determine its cash payout. Protect it independently of individual callers.
create function app_private.guard_paid_owner_settlement() returns trigger
language plpgsql set search_path to 'public','pg_temp' as $$
begin
 if old.status='PAID' and (tg_op='DELETE' or
   (to_jsonb(old)-array['notes','updated_at']) is distinct from (to_jsonb(new)-array['notes','updated_at'])) then
  raise exception 'OWNER_SETTLEMENT_PAID_EVIDENCE_IMMUTABLE: use a governed append-only adjustment.' using errcode='42501';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function app_private.guard_paid_owner_settlement() from public,anon,authenticated;
create trigger owner_settlement_paid_evidence_guard before update or delete on public.owner_settlements
 for each row execute function app_private.guard_paid_owner_settlement();
commit;
