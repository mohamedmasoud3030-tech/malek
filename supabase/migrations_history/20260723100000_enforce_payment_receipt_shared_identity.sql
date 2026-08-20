-- Final receipt/payment identity contract.
-- Every payment is receipt-backed and uses the receipt UUID as both its primary
-- key and receipt_id. This makes legacy/default generated payment IDs unable to
-- break the browser's payment-backed receipt lookup.
begin;

do $preflight_payment_receipt_identity$
declare
  mismatch_count integer;
  duplicate_count integer;
begin
  select count(*) into mismatch_count
  from public.payments p
  where p.receipt_id is null
     or p.id::text is distinct from p.receipt_id::text;

  if mismatch_count > 0 then
    raise exception
      'payment/receipt identity preflight failed: % existing payment rows have id <> receipt_id or no receipt_id; repair explicitly before applying this migration',
      mismatch_count;
  end if;

  select count(*) into duplicate_count
  from (
    select receipt_id
    from public.payments
    group by receipt_id
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception
      'payment/receipt identity preflight failed: % receipts have multiple payments; repair explicitly before applying this migration',
      duplicate_count;
  end if;
end
$preflight_payment_receipt_identity$;

create or replace function public.enforce_payment_receipt_shared_identity()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.receipt_id is null then
    raise exception 'payments.receipt_id is required: every payment must be backed by one receipt'
      using errcode = '23502';
  end if;

  -- `id` normally has a generated default. Replace it at the write boundary so
  -- all RPC variants converge on one immutable identity.
  new.id := new.receipt_id;
  return new;
end;
$function$;

drop trigger if exists payments_enforce_receipt_shared_identity on public.payments;
create trigger payments_enforce_receipt_shared_identity
before insert on public.payments
for each row execute function public.enforce_payment_receipt_shared_identity();

create or replace function public.prevent_payment_receipt_identity_mutation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if new.id is distinct from old.id or new.receipt_id is distinct from old.receipt_id then
    raise exception 'payments.id and payments.receipt_id are immutable after insert' using errcode = '23514';
  end if;
  return new;
end;
$function$;

drop trigger if exists payments_prevent_receipt_identity_mutation on public.payments;
create trigger payments_prevent_receipt_identity_mutation
before update of id, receipt_id on public.payments
for each row execute function public.prevent_payment_receipt_identity_mutation();

alter table public.payments
  drop constraint if exists payments_receipt_id_unique,
  add constraint payments_receipt_id_unique unique (receipt_id);

-- A payment can only point to an existing receipt. The receipt is inserted
-- first by post_receipt_atomic, so this does not introduce a cyclic write.
alter table public.payments
  drop constraint if exists payments_receipt_id_fkey,
  add constraint payments_receipt_id_fkey
  foreign key (receipt_id) references public.receipts(id) on delete restrict;

-- Counts only; historical data is never repaired by this migration.
create or replace function public.payment_receipt_identity_preflight()
returns table (payments_without_receipt_id bigint, payment_id_receipt_id_mismatches bigint, receipts_with_multiple_payments bigint, receipts_without_payment bigint)
language sql stable set search_path = public, pg_temp
as $function$
  select
    (select count(*) from public.payments p where p.receipt_id is null),
    (select count(*) from public.payments p where p.receipt_id is not null and p.id::text is distinct from p.receipt_id::text),
    (select count(*) from (select p.receipt_id from public.payments p group by p.receipt_id having count(*) > 1) d),
    (select count(*) from public.receipts r where not exists (select 1 from public.payments p where p.receipt_id::text = r.id::text));
$function$;

commit;
