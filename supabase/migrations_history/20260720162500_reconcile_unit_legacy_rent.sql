-- Restore unit prices that were historically stored in units.rent_default
-- after the application standardized on units.rent_amount.
--
-- Historical production still contains both columns, while clean replay
-- databases may contain only rent_amount. The migration is therefore
-- conditional and remains a no-op when the legacy column is absent.

begin;

do $reconcile_unit_rent$
declare
  v_has_rent_amount boolean;
  v_has_rent_default boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'units'
      and column_name = 'rent_amount'
  ) into v_has_rent_amount;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'units'
      and column_name = 'rent_default'
  ) into v_has_rent_default;

  if not (v_has_rent_amount and v_has_rent_default) then
    return;
  end if;

  execute $backfill$
    update public.units
    set rent_amount = rent_default
    where coalesce(rent_amount, 0) = 0
      and coalesce(rent_default, 0) > 0
  $backfill$;

  execute $function_definition$
    create or replace function public.sync_unit_rent_fields()
    returns trigger
    language plpgsql
    set search_path to 'public', 'pg_temp'
    as $trigger_body$
    begin
      if tg_op = 'INSERT' then
        if new.rent_amount is null
           or (new.rent_amount = 0 and coalesce(new.rent_default, 0) > 0) then
          new.rent_amount := new.rent_default;
        end if;
        new.rent_default := new.rent_amount;
        return new;
      end if;

      if new.rent_amount is distinct from old.rent_amount then
        new.rent_default := new.rent_amount;
      elsif new.rent_default is distinct from old.rent_default then
        new.rent_amount := new.rent_default;
      elsif new.rent_default is distinct from new.rent_amount then
        new.rent_default := new.rent_amount;
      end if;

      return new;
    end;
    $trigger_body$
  $function_definition$;

  execute 'drop trigger if exists sync_unit_rent_fields_on_units on public.units';
  execute $trigger_definition$
    create trigger sync_unit_rent_fields_on_units
    before insert or update of rent_amount, rent_default on public.units
    for each row execute function public.sync_unit_rent_fields()
  $trigger_definition$;

  execute 'revoke all on function public.sync_unit_rent_fields() from public, anon, authenticated';
end;
$reconcile_unit_rent$;

do $verify_unit_rent$
declare
  v_mismatch_count integer;
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'units'
      and column_name = 'rent_default'
  ) then
    return;
  end if;

  select count(*)
  into v_mismatch_count
  from public.units
  where rent_amount is distinct from rent_default;

  if v_mismatch_count > 0 then
    raise exception 'Unit rent reconciliation left % mismatched row(s)', v_mismatch_count;
  end if;
end;
$verify_unit_rent$;

commit;
