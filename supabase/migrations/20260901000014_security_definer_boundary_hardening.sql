-- MALEK governance stabilization — Phase 5
--
-- Close accidental direct API execution on SECURITY DEFINER helpers that are
-- implementation details, not browser-facing RPCs. This migration changes ACLs
-- only; it does not replace function bodies, trigger wiring, ownership, search
-- paths, or business behavior.
--
-- Verified current baseline facts before this migration:
--   * next_document_reference(uuid,text,text,integer) is SECURITY DEFINER,
--     accepts an explicit company id, and is called by the document-reference
--     trigger helper. It is not an end-user authorization boundary.
--   * assign_document_reference() is a SECURITY DEFINER trigger function and is
--     attached to document INSERT triggers.
--   * update_unit_status_from_activity() is a SECURITY DEFINER trigger function
--     attached to contracts and maintenance_records.
--   * all three currently grant EXECUTE to authenticated in the canonical
--     baseline, which unnecessarily exposes internal elevated helpers directly.
--
-- We intentionally do NOT apply blanket revokes to all SECURITY DEFINER
-- functions. Governed user-facing RPCs keep their intended authenticated ACLs.

begin;

do $phase5_boundary_assertions$
declare
  v_next oid := to_regprocedure('public.next_document_reference(uuid,text,text,integer)');
  v_assign oid := to_regprocedure('public.assign_document_reference()');
  v_unit_activity oid := to_regprocedure('public.update_unit_status_from_activity()');
  v_assign_triggers integer;
  v_unit_activity_triggers integer;
  v_assign_definition text;
begin
  if v_next is null then
    raise exception 'PHASE5_BOUNDARY_ABORT: missing public.next_document_reference(uuid,text,text,integer)';
  end if;
  if v_assign is null then
    raise exception 'PHASE5_BOUNDARY_ABORT: missing public.assign_document_reference()';
  end if;
  if v_unit_activity is null then
    raise exception 'PHASE5_BOUNDARY_ABORT: missing public.update_unit_status_from_activity()';
  end if;

  if not (select p.prosecdef from pg_proc p where p.oid = v_next) then
    raise exception 'PHASE5_BOUNDARY_ABORT: next_document_reference is no longer SECURITY DEFINER; re-audit before changing ACLs';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = v_assign) then
    raise exception 'PHASE5_BOUNDARY_ABORT: assign_document_reference is no longer SECURITY DEFINER; re-audit before changing ACLs';
  end if;
  if not (select p.prosecdef from pg_proc p where p.oid = v_unit_activity) then
    raise exception 'PHASE5_BOUNDARY_ABORT: update_unit_status_from_activity is no longer SECURITY DEFINER; re-audit before changing ACLs';
  end if;

  select pg_get_functiondef(v_assign) into v_assign_definition;
  if position('next_document_reference' in v_assign_definition) = 0 then
    raise exception 'PHASE5_BOUNDARY_ABORT: assign_document_reference no longer delegates to next_document_reference';
  end if;

  select count(*)::integer
    into v_assign_triggers
  from pg_trigger t
  where not t.tgisinternal
    and t.tgfoid = v_assign;

  if v_assign_triggers < 1 then
    raise exception 'PHASE5_BOUNDARY_ABORT: assign_document_reference has no trigger callers';
  end if;

  select count(*)::integer
    into v_unit_activity_triggers
  from pg_trigger t
  where not t.tgisinternal
    and t.tgfoid = v_unit_activity;

  if v_unit_activity_triggers < 2 then
    raise exception 'PHASE5_BOUNDARY_ABORT: expected contracts/maintenance trigger callers for update_unit_status_from_activity, found %', v_unit_activity_triggers;
  end if;
end
$phase5_boundary_assertions$;

-- Internal sequence allocator. The SECURITY DEFINER trigger helper executes as
-- its owner, so browser roles do not need direct EXECUTE on this allocator.
revoke all on function public.next_document_reference(uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.next_document_reference(uuid, text, text, integer)
  to service_role;

-- Trigger-only document reference helper. Trigger invocation does not require
-- the DML caller to hold direct EXECUTE on the trigger function.
revoke all on function public.assign_document_reference()
  from public, anon, authenticated;
grant execute on function public.assign_document_reference()
  to service_role;

-- Trigger-only unit synchronization helper. It remains wired to contracts and
-- maintenance_records; only direct API invocation is removed.
revoke all on function public.update_unit_status_from_activity()
  from public, anon, authenticated;
grant execute on function public.update_unit_status_from_activity()
  to service_role;

comment on function public.next_document_reference(uuid, text, text, integer) is
  'Internal SECURITY DEFINER document-sequence allocator. Direct anon/authenticated execution is revoked; use document insert paths/triggers.';
comment on function public.assign_document_reference() is
  'Internal SECURITY DEFINER trigger helper for document references. Direct API execution is revoked.';
comment on function public.update_unit_status_from_activity() is
  'Internal SECURITY DEFINER trigger helper for unit operational-status synchronization. Direct API execution is revoked.';

-- Postcondition: browser roles must not retain effective EXECUTE. Checking the
-- effective privilege (rather than only explicit ACL entries) also catches an
-- accidental PUBLIC grant.
do $phase5_boundary_postconditions$
declare
  v_signature text;
  v_role text;
begin
  foreach v_signature in array array[
    'public.next_document_reference(uuid,text,text,integer)',
    'public.assign_document_reference()',
    'public.update_unit_status_from_activity()'
  ]
  loop
    foreach v_role in array array['anon', 'authenticated']
    loop
      if has_function_privilege(v_role, v_signature, 'EXECUTE') then
        raise exception 'PHASE5_BOUNDARY_ABORT: % still has EXECUTE on %', v_role, v_signature;
      end if;
    end loop;

    if not has_function_privilege('service_role', v_signature, 'EXECUTE') then
      raise exception 'PHASE5_BOUNDARY_ABORT: service_role lost EXECUTE on %', v_signature;
    end if;
  end loop;
end
$phase5_boundary_postconditions$;

commit;
