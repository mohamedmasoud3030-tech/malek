-- Manual rollback for 20260809020000_s06_master_lease_gl_lifecycle.sql — not auto-applied, run by hand only.
-- Rollback for: 20260809020000_s06_master_lease_gl_lifecycle.sql
--
-- This rollback is intentionally non-destructive. Once any master-lease
-- measurement exists, rollback is refused; posted accounting must be corrected
-- with canonical GL reversals rather than deleting lifecycle history.

begin;

do $guard$
begin
  if to_regclass('public.master_lease_measurements') is not null
     and exists (select 1 from public.master_lease_measurements) then
    raise exception 'S06_ROLLBACK_REFUSED: master-lease measurements exist. Reverse financial postings; do not drop accounting history.';
  end if;
end
$guard$;

drop function if exists public.gl_ml_post_sublease_receipt(jsonb);
drop function if exists public.gl_ml_post_remeasurement(jsonb);
drop function if exists public.gl_ml_create_remeasurement(jsonb);
drop function if exists public.gl_ml_post_period(jsonb);
drop function if exists public.gl_ml_post_initial_recognition(jsonb);
drop function if exists public.gl_ml_create_initial_measurement(jsonb);
drop function if exists public.gl_ml_insert_schedule_rows(uuid,uuid,date,jsonb,integer,numeric,numeric,numeric,boolean);
drop function if exists public.gl_ml_measure_payments(jsonb,numeric,integer);

drop trigger if exists guard_master_lease_schedule_immutable on public.master_lease_schedule_rows;
drop trigger if exists guard_master_lease_measurement_immutable on public.master_lease_measurements;
drop trigger if exists guard_master_lease_measurement_parent on public.master_lease_measurements;
drop function if exists public.guard_master_lease_schedule_immutable();
drop function if exists public.guard_master_lease_measurement_immutable();
drop function if exists public.guard_master_lease_measurement_parent();

drop table if exists public.master_lease_schedule_rows;
drop table if exists public.master_lease_measurements;
drop function if exists public.gl_ml_provision_supporting_accounts(uuid);

-- Accounts 4400/6400 are deliberately retained. They are additive chart
-- configuration and may already be referenced by canonical journal history.
-- The existing Stage 3 master-lease accounts (1600/2500/4000/6200/6300) are
-- never touched by this rollback.

commit;
