begin;

drop trigger if exists units_archive_guard on public.units;
drop function if exists public.guard_unit_archive_history();

commit;
