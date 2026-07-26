-- Reconcile the live audit trigger with clean replays.
--
-- Live pre-change state (read-only verified 2026-07-27):
--   * SECURITY INVOKER
--   * service_role-only EXECUTE ACL
--   * explicit audit_log.id generation
--   * no pinned search_path (Supabase Advisor warning)
--
-- Clean replays previously ended on an older SECURITY DEFINER body because
-- 20260718205846_fix_audit_journal_entry_insert_missing_id.sql is a captured
-- live-ledger no-op. Define the full intended shape here so both paths converge.

begin;

create or replace function public.audit_journal_entry_insert()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if new.status = 'posted' then
    insert into public.audit_log (
      id, user_id, action, entity, entity_id, note, "table",
      old_value, new_value, action_timestamp, created_at, updated_at
    ) values (
      gen_random_uuid()::text,
      auth.uid(),
      'INSERT_POSTED_JOURNAL_ENTRY',
      'journal_entry',
      new.id::text,
      'Posted journal entry created. Corrections must use reversing entries.',
      'journal_entries',
      null,
      to_jsonb(new),
      now(),
      now(),
      now()
    );
  end if;

  return new;
end;
$function$;

alter function public.audit_journal_entry_insert() owner to postgres;
revoke all on function public.audit_journal_entry_insert() from public, anon, authenticated;
grant execute on function public.audit_journal_entry_insert() to service_role;

commit;
