-- Emergency/local rollback for
-- 20260730091000_reconcile_audit_journal_trigger_security.sql.
--
-- Restores the exact live pre-change function shape verified on 2026-07-27.
-- Production remains forward-only; use a new forward migration in normal use.

begin;

create or replace function public.audit_journal_entry_insert()
returns trigger
language plpgsql
security invoker
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
