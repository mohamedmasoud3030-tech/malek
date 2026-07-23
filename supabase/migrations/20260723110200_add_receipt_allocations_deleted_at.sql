-- void_receipt_atomic excludes soft-deleted allocations, so the allocation
-- table must expose the same nullable lifecycle marker used by the function.
begin;

alter table public.receipt_allocations
  add column if not exists deleted_at timestamptz;

commit;
