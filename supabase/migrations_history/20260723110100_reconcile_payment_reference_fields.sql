-- Reconcile the clean replay with the live dual-reference compatibility contract.
-- New receipt-backed writes use reference_no while legacy readers still use
-- reference_number; keep both fields synchronized at the table boundary.
begin;

create or replace function public.sync_payment_reference_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'INSERT' then
    new.reference_number := coalesce(new.reference_number, new.reference_no);
    new.reference_no := coalesce(new.reference_no, new.reference_number);
  elsif new.reference_number is distinct from old.reference_number then
    new.reference_no := new.reference_number;
  elsif new.reference_no is distinct from old.reference_no then
    new.reference_number := new.reference_no;
  else
    new.reference_number := coalesce(new.reference_number, new.reference_no);
    new.reference_no := coalesce(new.reference_no, new.reference_number);
  end if;

  return new;
end;
$function$;

drop trigger if exists payments_sync_reference_fields on public.payments;
create trigger payments_sync_reference_fields
before insert or update of reference_number, reference_no on public.payments
for each row execute function public.sync_payment_reference_fields();

commit;
