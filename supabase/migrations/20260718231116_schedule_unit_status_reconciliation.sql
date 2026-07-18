begin;

do $cron_schedule$
begin
  begin
    perform cron.unschedule('rentrix-unit-status-hourly');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'rentrix-unit-status-hourly',
    '5 * * * *',
    $cron$select public.recalculate_unit_statuses();$cron$
  );
exception when others then
  raise notice 'Unable to schedule unit status reconciliation: %', sqlerrm;
end
$cron_schedule$;

commit;
