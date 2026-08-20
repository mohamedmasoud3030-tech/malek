-- WP-02 / GAP-010: Authoritative, versioned company tax configuration.
-- Canonical rule: FIN-012 — tax/VAT is configuration-driven and versioned; no
-- statutory rate may be hard-coded as a universal truth.
--
-- Invariants enforced:
--   * Each company has effective-dated tax profiles (versioned). Exactly the
--     version whose effective window covers the economic date is authoritative.
--   * resolve_active_tax_profile() FAILS CLOSED (raises TAX_PROFILE_MISSING)
--     when no active profile covers the date — there is NO silent default rate
--     and NO fallback to legacy company_settings.
--   * Every taxable posting snapshots the exact authoritative tax_code / rate /
--     amount at the line, immutably (taxable_line_tax_snapshots).
--   * Activating a profile is a designated sensitive action requiring a different
--     approver (maker-checker); the prior overlapping ACTIVE profile is superseded.
--   * All amounts are OMR 3dp. Posting is RPC-only; company isolation enforced.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Tax code catalog (names/meaning only — never an implied statutory rate)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.tax_code_catalog (
  code text primary key,
  name_ar text not null,
  name_en text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.tax_code_catalog (code, name_ar, name_en, description) values
  ('VAT', 'ضريبة القيمة المضافة', 'Value Added Tax', 'Standard consumption tax applied to taxable supplies.'),
  ('VAT_ZERO', 'ضريبة القيمة المضافة صفرية', 'Zero-rated VAT', 'Taxable supply reported at a 0% rate.')
on conflict (code) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Versioned company tax profiles (authoritative, effective-dated)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.company_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  version_no integer not null,
  tax_code text not null references public.tax_code_catalog(code),
  tax_rate numeric(6,3) not null check (tax_rate >= 0 and tax_rate <= 100),
  effective_from date not null,
  effective_to date,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','ACTIVE','SUPERSEDED','VOID')),
  description text,
  created_by uuid not null,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_tax_profiles_version_uq unique (company_id, version_no),
  constraint company_tax_profiles_dates_chk
    check (effective_to is null or effective_from <= effective_to),
  constraint company_tax_profiles_approval_chk
    check (status not in ('APPROVED','ACTIVE') or (approved_by is not null and approved_at is not null)),
  constraint company_tax_profiles_maker_checker_chk
    check (approved_by is null or approved_by <> created_by)
);

create index if not exists company_tax_profiles_company_idx
  on public.company_tax_profiles (company_id, status, effective_from);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Immutable per-line tax snapshots (authoritative basis for 2100 reconciliation)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.taxable_line_tax_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  source_type text not null,
  source_id text not null,
  journal_batch_id uuid references public.journal_batches(id) on delete restrict,
  account_no text not null,
  tax_code text not null,
  tax_rate numeric(6,3) not null,
  net_amount numeric(18,3) not null,
  tax_amount numeric(18,3) not null,
  effective_date date not null,
  created_at timestamptz not null default now(),
  constraint taxable_line_tax_snapshots_amounts_chk
    check (net_amount >= 0 and tax_amount >= 0 and tax_rate >= 0)
);

create index if not exists taxable_line_tax_snapshots_company_idx
  on public.taxable_line_tax_snapshots (company_id, effective_date, tax_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RLS: company-scoped reads; direct authenticated writes denied
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.company_tax_profiles enable row level security;
alter table public.tax_code_catalog enable row level security;
alter table public.taxable_line_tax_snapshots enable row level security;

drop policy if exists company_tax_profiles_company_read on public.company_tax_profiles;
create policy company_tax_profiles_company_read on public.company_tax_profiles
  for select to authenticated
  using (company_id = public.current_company_id() and (public.is_admin_or_manager() or public.is_accountant()));

drop policy if exists taxable_line_tax_snapshots_company_read on public.taxable_line_tax_snapshots;
create policy taxable_line_tax_snapshots_company_read on public.taxable_line_tax_snapshots
  for select to authenticated
  using (company_id = public.current_company_id() and (public.is_admin_or_manager() or public.is_accountant()));

drop policy if exists tax_code_catalog_read on public.tax_code_catalog;
create policy tax_code_catalog_read on public.tax_code_catalog
  for select to authenticated
  using (public.is_app_user());

revoke all on table public.company_tax_profiles from public, anon, authenticated;
revoke all on table public.tax_code_catalog from public, anon, authenticated;
revoke all on table public.taxable_line_tax_snapshots from public, anon, authenticated;
grant select on table public.company_tax_profiles to authenticated;
grant select on table public.tax_code_catalog to authenticated;
grant select on table public.taxable_line_tax_snapshots to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Authoritative resolver — fails closed, never silently defaults
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.resolve_active_tax_profile(
  p_company_id uuid,
  p_effective_date date
)
returns table (
  profile_id uuid,
  tax_code text,
  tax_rate numeric,
  effective_from date,
  effective_to date
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if p_company_id is null or p_effective_date is null then
    raise exception 'TAX_PROFILE_RESOLVE_INPUT_REQUIRED' using errcode = '22023';
  end if;

  return query
    select p.id, p.tax_code, p.tax_rate, p.effective_from, p.effective_to
      from public.company_tax_profiles p
     where p.company_id = p_company_id
       and p.status in ('APPROVED','ACTIVE')
       and p.effective_from <= p_effective_date
       and (p.effective_to is null or p_effective_date <= p.effective_to)
     order by p.effective_from desc, p.version_no desc
     limit 1;

  if not found then
    raise exception 'TAX_PROFILE_MISSING: no authoritative tax profile covers %, company %. Posting blocked.',
      p_effective_date, p_company_id using errcode = 'P0001';
  end if;
end;
$fn$;

alter function public.resolve_active_tax_profile(uuid, date) owner to postgres;
revoke all on function public.resolve_active_tax_profile(uuid, date) from public, anon;
grant execute on function public.resolve_active_tax_profile(uuid, date) to authenticated, service_role;

create or replace function public.compute_tax_amount(p_net numeric, p_rate numeric)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $fn$
  select public.gl_pm_round_omr(coalesce(p_net, 0) * coalesce(p_rate, 0) / 100);
$fn$;

alter function public.compute_tax_amount(numeric, numeric) owner to postgres;
revoke all on function public.compute_tax_amount(numeric, numeric) from public, anon;
grant execute on function public.compute_tax_amount(numeric, numeric) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Profile lifecycle RPCs (maker-checker on activation)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_tax_profile_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_code text := nullif(btrim(coalesce(p_payload->>'tax_code','')), '');
  v_rate numeric := public.gl_pm_round_omr(nullif(p_payload->>'tax_rate','')::numeric);
  v_from date := nullif(p_payload->>'effective_from','')::date;
  v_to date := nullif(p_payload->>'effective_to','')::date;
  v_desc text := nullif(btrim(coalesce(p_payload->>'description','')), '');
  v_version integer;
  v_id uuid := gen_random_uuid();
  v_cached jsonb;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'TAX_PROFILE_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if p_payload ?| array['company_id','tax_rate_override','default_rate'] then
    raise exception 'TAX_PROFILE_SERVER_OWNED_FIELDS_FORBIDDEN' using errcode = '22023';
  end if;
  if v_request_id is null or v_code is null or v_rate is null or v_rate < 0 or v_rate > 100 or v_from is null then
    raise exception 'TAX_PROFILE_REQUEST_CODE_RATE_FROM_REQUIRED' using errcode = '22023';
  end if;
  if v_to is not null and v_to < v_from then
    raise exception 'TAX_PROFILE_DATE_RANGE_INVALID' using errcode = '22023';
  end if;
  if not exists (select 1 from public.tax_code_catalog where code = v_code and is_active) then
    raise exception 'TAX_PROFILE_CODE_UNKNOWN' using errcode = '23514';
  end if;

  select coalesce(max(version_no), 0) + 1 into v_version
    from public.company_tax_profiles where company_id = v_company_id;

  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = 'create_tax_profile_atomic:' || v_company_id::text
     and request_id = v_request_id;
  if v_cached is not null then
    return v_cached || jsonb_build_object('idempotent', true);
  end if;

  insert into public.company_tax_profiles (
    id, company_id, version_no, tax_code, tax_rate, effective_from, effective_to,
    status, description, created_by
  ) values (
    v_id, v_company_id, v_version, v_code, v_rate, v_from, v_to, 'DRAFT', v_desc, v_actor
  );

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'profile_id', v_id, 'company_id', v_company_id,
    'version_no', v_version, 'tax_code', v_code, 'tax_rate', v_rate, 'status', 'DRAFT', 'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('create_tax_profile_atomic:' || v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$fn$;

alter function public.create_tax_profile_atomic(jsonb) owner to postgres;
revoke all on function public.create_tax_profile_atomic(jsonb) from public, anon;
grant execute on function public.create_tax_profile_atomic(jsonb) to authenticated, service_role;

create or replace function public.approve_tax_profile_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_profile_id uuid := nullif(p_payload->>'profile_id','')::uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_profile public.company_tax_profiles%rowtype;
  v_cached jsonb;
  v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'TAX_PROFILE_APPROVER_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if v_profile_id is null or v_request_id is null then
    raise exception 'TAX_PROFILE_APPROVE_ID_REQUEST_REQUIRED' using errcode = '22023';
  end if;

  select * into v_profile
    from public.company_tax_profiles where id = v_profile_id and company_id = v_company_id for update;
  if not found then
    raise exception 'TAX_PROFILE_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_profile.status = 'ACTIVE' then
    return jsonb_build_object('success', true, 'idempotent', true, 'profile_id', v_profile.id, 'status', 'ACTIVE');
  end if;
  if v_profile.status <> 'DRAFT' then
    raise exception 'TAX_PROFILE_NOT_DRAFT' using errcode = '22023';
  end if;
  if v_profile.created_by = v_actor then
    raise exception 'TAX_PROFILE_MAKER_CHECKER_REQUIRED: a different approver must activate the profile.' using errcode = '42501';
  end if;

  -- Supersede any currently ACTIVE profile with an overlapping effective window.
  update public.company_tax_profiles
     set status = 'SUPERSEDED', updated_at = now()
   where company_id = v_company_id
     and id <> v_profile.id
     and status = 'ACTIVE'
     and (effective_to is null or effective_from <= coalesce(v_profile.effective_to, 'infinity'::date));

  update public.company_tax_profiles
     set status = 'ACTIVE', approved_by = v_actor, approved_at = now(), updated_at = now()
   where id = v_profile.id;

  v_result := jsonb_build_object('success', true, 'idempotent', false, 'profile_id', v_profile.id, 'status', 'ACTIVE',
    'tax_code', v_profile.tax_code, 'tax_rate', v_profile.tax_rate, 'request_id', v_request_id);
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('approve_tax_profile_atomic:' || v_company_id::text, v_request_id, v_result)
  on conflict (operation_name, request_id) do nothing;
  return v_result;
end;
$fn$;

alter function public.approve_tax_profile_atomic(jsonb) owner to postgres;
revoke all on function public.approve_tax_profile_atomic(jsonb) from public, anon;
grant execute on function public.approve_tax_profile_atomic(jsonb) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Governed taxable collection — resolves tax authoritatively, blocks when
--    missing, snapshots per line, posts via the canonical engine. Demonstrates
--    the GAP-010 mechanism end-to-end (Dr cash gross / Cr 2000 net / Cr 2100 tax).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.post_taxable_collection_atomic(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_actor uuid := auth.uid();
  v_company_id uuid;
  v_request_id text := nullif(btrim(coalesce(p_payload->>'request_id','')), '');
  v_net numeric := public.gl_pm_round_omr(nullif(p_payload->>'net_amount','')::numeric);
  v_cash_no text := coalesce(nullif(p_payload->>'cash_account_no',''), '1120');
  v_date date := nullif(p_payload->>'effective_date','')::date;
  v_profile record;
  v_tax numeric;
  v_gross numeric;
  v_cash_id text; v_ofp_id text; v_vat_id text;
  v_post jsonb; v_batch_id uuid;
  v_fp text; v_cached jsonb; v_id uuid := gen_random_uuid(); v_result jsonb;
begin
  if v_actor is null or not (public.is_admin_or_manager() or public.is_accountant()) then
    raise exception 'TAXABLE_COLLECTION_ROLE_REQUIRED' using errcode = '42501';
  end if;
  v_company_id := public.require_company_id();
  if p_payload ?| array['company_id','tax_code','tax_rate','tax_amount'] then
    raise exception 'TAXABLE_COLLECTION_CLIENT_TAX_FORBIDDEN: tax is server-resolved from the authoritative profile.' using errcode = '22023';
  end if;
  if v_request_id is null or v_net is null or v_net <= 0 or v_date is null then
    raise exception 'TAXABLE_COLLECTION_REQUEST_NET_DATE_REQUIRED' using errcode = '22023';
  end if;
  if v_cash_no not in ('1111','1120') then
    raise exception 'TAXABLE_COLLECTION_CASH_ACCOUNT_INVALID' using errcode = '22023';
  end if;

  -- Authoritative resolution — fails closed when no profile covers the date.
  select * into v_profile from public.resolve_active_tax_profile(v_company_id, v_date);
  v_tax := public.compute_tax_amount(v_net, v_profile.tax_rate);
  v_gross := public.gl_pm_round_omr(v_net + v_tax);

  v_fp := encode(sha256(convert_to(jsonb_build_object('net_amount', v_net, 'effective_date', v_date)::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('taxable_collection:' || v_company_id::text || ':' || v_request_id, 0));

  select response_payload into v_cached
    from public.financial_operation_idempotency
   where operation_name = 'post_taxable_collection_atomic:' || v_company_id::text
     and request_id = v_request_id for update;
  if v_cached is not null then
    if v_cached->>'_request_fingerprint' is distinct from v_fp or not (v_cached ? 'response') then
      raise exception 'IDEMPOTENCY_KEY_REUSED_FOR_DIFFERENT_REQUEST' using errcode = '22023';
    end if;
    return v_cached->'response';
  end if;

  v_cash_id := public.gl_pm_require_account(v_company_id, v_cash_no);
  v_ofp_id  := public.gl_pm_require_account(v_company_id, '2000');
  v_vat_id  := public.gl_pm_require_account(v_company_id, '2100');

  v_post := public.post_journal_event(jsonb_build_object(
    'company_id', v_company_id, 'source_type', 'pm_taxable_collection', 'source_id', v_id::text,
    'event_id', 'collect', 'effective_date', v_date,
    'description', 'Taxable owner-agency collection (authoritative tax resolved)',
    'lines', jsonb_build_array(
      jsonb_build_object('account_id', v_cash_id, 'debit', v_gross, 'credit', 0,
        'ref_source_id', v_id::text, 'ref_entity_type', 'taxable_collection', 'ref_entity_id', v_id::text),
      jsonb_build_object('account_id', v_ofp_id, 'debit', 0, 'credit', v_net,
        'ref_source_id', v_id::text, 'ref_entity_type', 'taxable_collection', 'ref_entity_id', v_id::text),
      jsonb_build_object('account_id', v_vat_id, 'debit', 0, 'credit', v_tax,
        'ref_source_id', v_id::text, 'ref_entity_type', 'taxable_collection', 'ref_entity_id', v_id::text)
    )
  ));
  v_batch_id := (v_post->>'batch_id')::uuid;

  insert into public.taxable_line_tax_snapshots (
    company_id, source_type, source_id, journal_batch_id, account_no,
    tax_code, tax_rate, net_amount, tax_amount, effective_date
  ) values (
    v_company_id, 'pm_taxable_collection', v_id::text, v_batch_id, '2100',
    v_profile.tax_code, v_profile.tax_rate, v_net, v_tax, v_date
  );

  v_result := jsonb_build_object(
    'success', true, 'idempotent', false, 'source_id', v_id::text, 'net_amount', v_net,
    'tax_code', v_profile.tax_code, 'tax_rate', v_profile.tax_rate, 'tax_amount', v_tax,
    'gross_amount', v_gross, 'journal_batch_id', v_batch_id, 'request_id', v_request_id
  );
  insert into public.financial_operation_idempotency (operation_name, request_id, response_payload)
  values ('post_taxable_collection_atomic:' || v_company_id::text, v_request_id,
          jsonb_build_object('_request_fingerprint', v_fp, 'response', v_result));
  return v_result;
end;
$fn$;

alter function public.post_taxable_collection_atomic(jsonb) owner to postgres;
revoke all on function public.post_taxable_collection_atomic(jsonb) from public, anon;
grant execute on function public.post_taxable_collection_atomic(jsonb) to authenticated, service_role;

comment on table public.company_tax_profiles is 'GAP-010 authoritative, versioned company tax configuration; no universal statutory rate.';
comment on table public.taxable_line_tax_snapshots is 'GAP-010 immutable per-line tax snapshots; 2100 GL reconciles to these.';
comment on function public.resolve_active_tax_profile(uuid, date) is 'GAP-010 authoritative tax resolver; raises TAX_PROFILE_MISSING instead of defaulting.';

commit;
