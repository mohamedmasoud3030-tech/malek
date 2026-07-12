-- =============================================================================
-- Migration: owner settlement lifecycle foundation
-- Scope: schema only; no settlement rows are generated and no production data is
--        mutated beyond safe column defaults/constraints.
-- Policy source: docs/decisions/0001-product-accounting-policies.md
-- =============================================================================

begin;

alter table public.owner_settlements
  add column if not exists property_id text,
  add column if not exists period_start date,
  add column if not exists period_end date,
  add column if not exists gross_collected numeric not null default 0,
  add column if not exists office_fee numeric not null default 0,
  add column if not exists owner_expenses numeric not null default 0,
  add column if not exists tax_amount numeric not null default 0,
  add column if not exists net_payable numeric not null default 0,
  add column if not exists request_id uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by uuid,
  add column if not exists payment_reference text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid,
  add column if not exists cancellation_reason text;

alter table public.owner_settlements
  alter column status set default 'DRAFT';

alter table public.owner_settlements
  drop constraint if exists owner_settlements_status_check;

alter table public.owner_settlements
  add constraint owner_settlements_status_check
  check (status = any (array['DRAFT', 'APPROVED', 'PAID', 'CANCELLED']));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'owner_settlements_period_check'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint owner_settlements_period_check
      check (
        (period_start is null and period_end is null)
        or (period_start is not null and period_end is not null and period_start <= period_end)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'owner_settlements_amounts_non_negative_check'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint owner_settlements_amounts_non_negative_check
      check (
        gross_collected >= 0
        and office_fee >= 0
        and owner_expenses >= 0
        and tax_amount >= 0
        and net_payable >= 0
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'owner_settlements_net_payable_check'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint owner_settlements_net_payable_check
      check (
        net_payable = greatest(
          gross_collected - office_fee - owner_expenses - tax_amount,
          0
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'owner_settlements_approval_state_check'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint owner_settlements_approval_state_check
      check (
        status = 'DRAFT'
        or (
          status in ('APPROVED', 'PAID')
          and approved_at is not null
          and approved_by is not null
        )
        or status = 'CANCELLED'
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'owner_settlements_payment_state_check'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint owner_settlements_payment_state_check
      check (
        status <> 'PAID'
        or (
          paid_at is not null
          and paid_by is not null
          and nullif(btrim(coalesce(method, '')), '') is not null
        )
      ) not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'owner_settlements_cancellation_state_check'
      and conrelid = 'public.owner_settlements'::regclass
  ) then
    alter table public.owner_settlements
      add constraint owner_settlements_cancellation_state_check
      check (
        status <> 'CANCELLED'
        or (
          cancelled_at is not null
          and cancelled_by is not null
          and nullif(btrim(coalesce(cancellation_reason, '')), '') is not null
        )
      ) not valid;
  end if;
end $$;

create unique index if not exists owner_settlements_request_id_uidx
  on public.owner_settlements (request_id)
  where request_id is not null;

create index if not exists owner_settlements_owner_period_idx
  on public.owner_settlements (owner_id, period_start, period_end)
  where status <> 'CANCELLED';

create index if not exists owner_settlements_status_updated_idx
  on public.owner_settlements (status, updated_at desc);

comment on column public.owner_settlements.gross_collected is
  'Eligible collected rent on the cash basis; excludes deposits, refunds, and utility pass-throughs unless explicitly enabled by contract policy.';
comment on column public.owner_settlements.office_fee is
  'Office fee recognized from eligible collections and deducted when the settlement is approved.';
comment on column public.owner_settlements.owner_expenses is
  'Approved owner-responsibility expenses deducted in the settlement period.';
comment on column public.owner_settlements.tax_amount is
  'Optional separately presented tax/VAT on the office fee; zero when tax treatment is disabled.';
comment on column public.owner_settlements.request_id is
  'Idempotency key supplied by the mutation RPC; duplicate requests must resolve to the same settlement.';

commit;
