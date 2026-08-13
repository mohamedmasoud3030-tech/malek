-- =============================================================================
-- WP-05 GAP-015 — S08 Frozen Historical Review infrastructure and evidence
-- Governed frozen-review artifact, immutable/append-only, lifecycle enforcement
-- =============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Fingerprint helper — deterministic dataset hash (OMR 3dp, company + period)
-- ---------------------------------------------------------------------------
create or replace function public.s08_compute_dataset_fingerprint(
  p_company_id uuid,
  p_period_id uuid
)
returns text
language plpgsql
stable
set search_path = public, pg_temp, extensions
as $$
declare
  v_period_start date;
  v_period_end date;
  v_gl_hash text;
  v_subledger_hash text;
  v_combined text;
  v_digest text;
begin
  if p_company_id is null or p_period_id is null then
    raise exception 'S08_FINGERPRINT_COMPANY_AND_PERIOD_REQUIRED' using errcode='22023';
  end if;

  select start_date, end_date into v_period_start, v_period_end
  from public.accounting_periods
  where id = p_period_id and company_id = p_company_id;

  if not found then
    raise exception 'S08_PERIOD_NOT_FOUND: period % not found for company %', p_period_id, p_company_id using errcode='P0002';
  end if;

  -- GL hash: hash of all journal_batches + lines for company up to period end, ordered deterministically
  select encode(digest(
    coalesce(string_agg(
      jb.id::text || '|' || jb.status || '|' || jb.source_type || '|' || jb.source_id || '|' || jb.event_id || '|' || jb.effective_date::text || '|' ||
      jl.id || '|' || jl.account_id || '|' || jl.debit::text || '|' || jl.credit::text
      , ',' order by jb.effective_date, jb.id, jl.id
    ), ''), 'sha256'), 'hex')
  into v_gl_hash
  from public.journal_batches jb
  join public.journal_lines jl on jl.batch_id = jb.id and jl.company_id = p_company_id and jl.deleted_at is null
  where jb.company_id = p_company_id
    and jb.effective_date <= v_period_end;

  -- Subledger hash: hash of key subledger tables counts/balances
  with sub as (
    select 'tenant_deposits' as tbl, count(*)::text as cnt, coalesce(sum(remaining_amount),0)::text as bal from public.tenant_deposits where company_id = p_company_id and deleted_at is null
    union all
    select 'invoices', count(*)::text, coalesce(sum(amount + coalesce(tax_amount,0) - coalesce(paid_amount,0)),0)::text from public.invoices where company_id = p_company_id and deleted_at is null
    union all
    select 'payments', count(*)::text, coalesce(sum(amount),0)::text from public.payments where company_id = p_company_id and deleted_at is null
    union all
    select 'expenses', count(*)::text, coalesce(sum(amount),0)::text from public.expenses where company_id = p_company_id and deleted_at is null
    union all
    select 'commissions', count(*)::text, coalesce(sum(amount),0)::text from public.commissions where company_id = p_company_id
    union all
    select 'owner_balances', count(*)::text, coalesce(sum(net_balance),0)::text from public.owner_balances where company_id = p_company_id
  )
  select encode(digest(coalesce(string_agg(tbl || ':' || cnt || ':' || bal, ',' order by tbl), ''), 'sha256'), 'hex')
  into v_subledger_hash
  from sub;

  v_combined := p_company_id::text || '|' || p_period_id::text || '|' || v_period_start::text || '|' || v_period_end::text || '|' || coalesce(v_gl_hash,'') || '|' || coalesce(v_subledger_hash,'');

  select encode(digest(v_combined, 'sha256'), 'hex') into v_digest;

  return v_digest;
end;
$$;

revoke all on function public.s08_compute_dataset_fingerprint(uuid,uuid) from public, anon;
grant execute on function public.s08_compute_dataset_fingerprint(uuid,uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Table s08_frozen_reviews — immutable, append-only, company scoped
-- ---------------------------------------------------------------------------
create table if not exists public.s08_frozen_reviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  accounting_period_id uuid references public.accounting_periods(id) on delete restrict,
  review_scope jsonb not null default '{}'::jsonb,
  dataset_fingerprint text not null,
  dataset_lineage text not null,
  creation_timestamp timestamptz not null default now(),
  analysis_version text not null,
  analysis_results jsonb,
  reconciliation_evidence jsonb,
  exceptions jsonb,
  evidence_reference text,
  reviewer_decision text not null default 'CREATED' check (reviewer_decision in ('CREATED','ANALYZED','APPROVED','REJECTED')),
  reviewer_id uuid,
  reviewed_at timestamptz,
  review_notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint s08_frozen_reviews_fingerprint_not_empty check (btrim(dataset_fingerprint) <> ''),
  constraint s08_frozen_reviews_lineage_not_empty check (btrim(dataset_lineage) <> ''),
  constraint s08_frozen_reviews_version_not_empty check (btrim(analysis_version) <> '')
);

comment on table public.s08_frozen_reviews is 'WP-05 GAP-015: governed frozen-review artifact, immutable/append-only, lifecycle CREATED→ANALYZED→APPROVED|REJECTED, reviewer decision is accounting control.';

create index if not exists s08_frozen_reviews_company_idx on public.s08_frozen_reviews (company_id);
create index if not exists s08_frozen_reviews_period_idx on public.s08_frozen_reviews (accounting_period_id);
create index if not exists s08_frozen_reviews_company_period_decision_idx on public.s08_frozen_reviews (company_id, accounting_period_id, reviewer_decision);
create index if not exists s08_frozen_reviews_fingerprint_idx on public.s08_frozen_reviews (dataset_fingerprint);
create unique index if not exists s08_frozen_reviews_company_period_fingerprint_uidx on public.s08_frozen_reviews (company_id, accounting_period_id, dataset_fingerprint);

-- RLS
alter table public.s08_frozen_reviews enable row level security;
alter table public.s08_frozen_reviews alter column company_id set default public.current_company_id();

drop policy if exists p0_tenant_isolation on public.s08_frozen_reviews;
create policy p0_tenant_isolation on public.s08_frozen_reviews as restrictive
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

drop policy if exists s08_frozen_reviews_read on public.s08_frozen_reviews;
create policy s08_frozen_reviews_read on public.s08_frozen_reviews
  for select to authenticated using (public.is_app_user());

drop policy if exists s08_frozen_reviews_write on public.s08_frozen_reviews;
create policy s08_frozen_reviews_write on public.s08_frozen_reviews
  for all to authenticated using (false) with check (false);

revoke all on public.s08_frozen_reviews from public, anon;
grant select on public.s08_frozen_reviews to authenticated;
grant all on public.s08_frozen_reviews to service_role;

-- Updated_at trigger (only allowed via authorized function)
drop trigger if exists trg_s08_frozen_reviews_updated_at on public.s08_frozen_reviews;
create trigger trg_s08_frozen_reviews_updated_at
  before update on public.s08_frozen_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Immutability guard: prevent destructive UPDATE/DELETE of historical evidence
--    Only allowed transitions via authorized RPCs that set session marker
-- ---------------------------------------------------------------------------
create or replace function public.guard_s08_frozen_review_writes()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_authorized text := coalesce(current_setting('malik.s08_review_change_authorized', true), '');
begin
  if tg_op = 'DELETE' then
    raise exception 'S08_FROZEN_REVIEW_IMMUTABLE: frozen reviews cannot be deleted, they are append-only historical evidence.' using errcode='42501';
  end if;

  if tg_op = 'UPDATE' then
    -- Allow updates only through authorized RPCs (they set the marker)
    if v_authorized <> 'true' then
      raise exception 'S08_FROZEN_REVIEW_IMMUTABLE: direct updates are forbidden, use s08_* RPCs.' using errcode='42501';
    end if;

    -- Fingerprint, company, period, lineage, creation_timestamp, created_at are immutable
    if old.company_id is distinct from new.company_id then
      raise exception 'S08_FROZEN_REVIEW_IMMUTABLE_FIELD: company_id cannot be changed' using errcode='42501';
    end if;
    if old.accounting_period_id is distinct from new.accounting_period_id then
      raise exception 'S08_FROZEN_REVIEW_IMMUTABLE_FIELD: accounting_period_id cannot be changed' using errcode='42501';
    end if;
    if old.dataset_fingerprint is distinct from new.dataset_fingerprint then
      raise exception 'S08_FROZEN_REVIEW_IMMUTABLE_FIELD: dataset_fingerprint cannot be changed' using errcode='42501';
    end if;
    if old.dataset_lineage is distinct from new.dataset_lineage then
      raise exception 'S08_FROZEN_REVIEW_IMMUTABLE_FIELD: dataset_lineage cannot be changed' using errcode='42501';
    end if;
    if old.creation_timestamp is distinct from new.creation_timestamp then
      raise exception 'S08_FROZEN_REVIEW_IMMUTABLE_FIELD: creation_timestamp cannot be changed' using errcode='42501';
    end if;
    if old.created_at is distinct from new.created_at then
      raise exception 'S08_FROZEN_REVIEW_IMMUTABLE_FIELD: created_at cannot be changed' using errcode='42501';
    end if;

    -- Lifecycle transitions enforcement
    if old.reviewer_decision = 'CREATED' and new.reviewer_decision not in ('ANALYZED','REJECTED') then
      raise exception 'S08_REVIEW_LIFECYCLE_ILLEGAL: CREATED can only transition to ANALYZED or REJECTED, got %', new.reviewer_decision using errcode='23514';
    end if;
    if old.reviewer_decision = 'ANALYZED' and new.reviewer_decision not in ('APPROVED','REJECTED') then
      raise exception 'S08_REVIEW_LIFECYCLE_ILLEGAL: ANALYZED can only transition to APPROVED or REJECTED, got %', new.reviewer_decision using errcode='23514';
    end if;
    if old.reviewer_decision in ('APPROVED','REJECTED') and new.reviewer_decision is distinct from old.reviewer_decision then
      raise exception 'S08_REVIEW_LIFECYCLE_TERMINAL: % is terminal and cannot transition to %', old.reviewer_decision, new.reviewer_decision using errcode='23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists guard_s08_frozen_review_writes on public.s08_frozen_reviews;
create trigger guard_s08_frozen_review_writes
  before update or delete on public.s08_frozen_reviews
  for each row execute function public.guard_s08_frozen_review_writes();

-- ---------------------------------------------------------------------------
-- 4. RPCs for lifecycle management
-- ---------------------------------------------------------------------------

-- Create frozen review (CREATED)
create or replace function public.s08_create_frozen_review(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp, extensions
as $$
declare
  v_company_id uuid;
  v_period_id uuid;
  v_review_scope jsonb;
  v_fingerprint text;
  v_lineage text;
  v_version text;
  v_evidence_ref text;
  v_results jsonb;
  v_recon jsonb;
  v_exceptions jsonb;
  v_id uuid;
  v_computed_fingerprint text;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER role required for S08 review creation' using errcode='42501';
  end if;

  v_company_id := public.require_company_id();
  v_period_id := nullif(p_payload->>'accounting_period_id','')::uuid;
  v_review_scope := coalesce(p_payload->'review_scope', '{}'::jsonb);
  v_version := coalesce(nullif(btrim(p_payload->>'analysis_version'),''), 'v1');
  v_evidence_ref := nullif(p_payload->>'evidence_reference','');
  v_results := p_payload->'analysis_results';
  v_recon := p_payload->'reconciliation_evidence';
  v_exceptions := p_payload->'exceptions';
  v_lineage := coalesce(nullif(btrim(p_payload->>'dataset_lineage'),''), 'default-lineage');

  if v_period_id is null then
    raise exception 'S08_REVIEW_PERIOD_REQUIRED: accounting_period_id required' using errcode='22023';
  end if;

  -- Compute fingerprint deterministically
  v_computed_fingerprint := public.s08_compute_dataset_fingerprint(v_company_id, v_period_id);
  v_fingerprint := coalesce(nullif(btrim(p_payload->>'dataset_fingerprint'),''), v_computed_fingerprint);

  -- Fail-closed if provided fingerprint does not match computed (prevents silent change)
  if btrim(p_payload->>'dataset_fingerprint') <> '' and v_fingerprint <> v_computed_fingerprint then
    raise exception 'S08_FINGERPRINT_MISMATCH: provided fingerprint % does not match computed % for company % period %', v_fingerprint, v_computed_fingerprint, v_company_id, v_period_id using errcode='22023';
  end if;

  perform set_config('malik.s08_review_change_authorized', 'true', true);

  insert into public.s08_frozen_reviews (
    company_id, accounting_period_id, review_scope, dataset_fingerprint, dataset_lineage,
    analysis_version, analysis_results, reconciliation_evidence, exceptions, evidence_reference,
    reviewer_decision, created_by
  ) values (
    v_company_id, v_period_id, v_review_scope, v_fingerprint, v_lineage,
    v_version, v_results, v_recon, v_exceptions, v_evidence_ref,
    'CREATED', auth.uid()
  )
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id, 'company_id', v_company_id, 'period_id', v_period_id, 'fingerprint', v_fingerprint, 'status', 'CREATED');
end;
$$;

-- Analyze review: CREATED → ANALYZED
create or replace function public.s08_analyze_frozen_review(p_review_id uuid, p_analysis_results jsonb default null, p_reconciliation_evidence jsonb default null, p_exceptions jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_review public.s08_frozen_reviews%rowtype;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required for S08 analysis' using errcode='42501';
  end if;

  if p_review_id is null then
    raise exception 'S08_REVIEW_ID_REQUIRED' using errcode='22023';
  end if;

  select * into v_review from public.s08_frozen_reviews where id = p_review_id and company_id = v_company_id for update;
  if not found then
    raise exception 'S08_REVIEW_NOT_FOUND: review % not found for company %', p_review_id, v_company_id using errcode='P0002';
  end if;

  if v_review.reviewer_decision <> 'CREATED' then
    raise exception 'S08_REVIEW_LIFECYCLE_ILLEGAL: only CREATED can transition to ANALYZED, current %', v_review.reviewer_decision using errcode='23514';
  end if;

  perform set_config('malik.s08_review_change_authorized', 'true', true);

  update public.s08_frozen_reviews
  set analysis_results = coalesce(p_analysis_results, analysis_results),
      reconciliation_evidence = coalesce(p_reconciliation_evidence, reconciliation_evidence),
      exceptions = coalesce(p_exceptions, exceptions),
      reviewer_decision = 'ANALYZED',
      updated_at = now()
  where id = p_review_id;

  return jsonb_build_object('success', true, 'id', p_review_id, 'status', 'ANALYZED');
end;
$$;

-- Approve review: ANALYZED → APPROVED (accounting control)
create or replace function public.s08_approve_frozen_review(p_review_id uuid, p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_review public.s08_frozen_reviews%rowtype;
  v_is_accountant boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required for S08 approval' using errcode='42501';
  end if;

  -- Approval is accounting control: require ACCOUNTANT or ADMIN
  v_is_accountant := public.is_accountant() or public.is_admin();
  if not v_is_accountant then
    raise exception 'S08_APPROVAL_REQUIRES_ACCOUNTANT: ACCOUNTANT or ADMIN role required to approve frozen review' using errcode='42501';
  end if;

  if p_review_id is null then
    raise exception 'S08_REVIEW_ID_REQUIRED' using errcode='22023';
  end if;

  select * into v_review from public.s08_frozen_reviews where id = p_review_id and company_id = v_company_id for update;
  if not found then
    raise exception 'S08_REVIEW_NOT_FOUND' using errcode='P0002';
  end if;

  if v_review.reviewer_decision <> 'ANALYZED' then
    raise exception 'S08_REVIEW_LIFECYCLE_ILLEGAL: only ANALYZED can be APPROVED, current %', v_review.reviewer_decision using errcode='23514';
  end if;

  -- Verify fingerprint still matches current dataset (no silent change under approval)
  declare v_current_fp text;
  begin
    v_current_fp := public.s08_compute_dataset_fingerprint(v_company_id, v_review.accounting_period_id);
    if v_current_fp <> v_review.dataset_fingerprint then
      raise exception 'S08_FINGERPRINT_CHANGED_UNDER_REVIEW: current fingerprint % does not match review fingerprint % — dataset changed after review creation, approval blocked', v_current_fp, v_review.dataset_fingerprint using errcode='P0001';
    end if;
  end;

  perform set_config('malik.s08_review_change_authorized', 'true', true);

  update public.s08_frozen_reviews
  set reviewer_decision = 'APPROVED',
      reviewer_id = auth.uid(),
      reviewed_at = now(),
      review_notes = coalesce(p_notes, review_notes),
      updated_at = now()
  where id = p_review_id;

  return jsonb_build_object('success', true, 'id', p_review_id, 'status', 'APPROVED', 'fingerprint', v_review.dataset_fingerprint);
end;
$$;

-- Reject review: ANALYZED → REJECTED or CREATED → REJECTED
create or replace function public.s08_reject_frozen_review(p_review_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_review public.s08_frozen_reviews%rowtype;
begin
  if auth.uid() is null or not public.is_admin_or_manager() then
    raise exception 'ADMIN or MANAGER required for S08 rejection' using errcode='42501';
  end if;

  if p_review_id is null then
    raise exception 'S08_REVIEW_ID_REQUIRED' using errcode='22023';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'S08_REJECTION_REASON_REQUIRED: reason required for rejection' using errcode='22023';
  end if;

  select * into v_review from public.s08_frozen_reviews where id = p_review_id and company_id = v_company_id for update;
  if not found then
    raise exception 'S08_REVIEW_NOT_FOUND' using errcode='P0002';
  end if;

  if v_review.reviewer_decision not in ('CREATED','ANALYZED') then
    raise exception 'S08_REVIEW_LIFECYCLE_ILLEGAL: only CREATED or ANALYZED can be REJECTED, current %', v_review.reviewer_decision using errcode='23514';
  end if;

  perform set_config('malik.s08_review_change_authorized', 'true', true);

  update public.s08_frozen_reviews
  set reviewer_decision = 'REJECTED',
      reviewer_id = auth.uid(),
      reviewed_at = now(),
      review_notes = p_reason,
      updated_at = now()
  where id = p_review_id;

  return jsonb_build_object('success', true, 'id', p_review_id, 'status', 'REJECTED');
end;
$$;

-- Verify fingerprint still valid (replay protection)
create or replace function public.s08_verify_fingerprint(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_review public.s08_frozen_reviews%rowtype;
  v_current text;
begin
  if p_review_id is null then
    raise exception 'S08_REVIEW_ID_REQUIRED' using errcode='22023';
  end if;

  select * into v_review from public.s08_frozen_reviews where id = p_review_id and company_id = v_company_id;
  if not found then
    raise exception 'S08_REVIEW_NOT_FOUND' using errcode='P0002';
  end if;

  v_current := public.s08_compute_dataset_fingerprint(v_company_id, v_review.accounting_period_id);

  return jsonb_build_object(
    'review_id', p_review_id,
    'stored_fingerprint', v_review.dataset_fingerprint,
    'current_fingerprint', v_current,
    'matches', (v_current = v_review.dataset_fingerprint),
    'company_id', v_company_id
  );
end;
$$;

-- List reviews (company-scoped)
create or replace function public.s08_list_frozen_reviews(p_period_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid := public.require_company_id();
  v_rows jsonb;
begin
  if auth.uid() is null or not public.is_app_user() then
    raise exception 'Authenticated app user required' using errcode='42501';
  end if;

  select jsonb_agg(jsonb_build_object(
    'id', r.id,
    'company_id', r.company_id,
    'accounting_period_id', r.accounting_period_id,
    'dataset_fingerprint', r.dataset_fingerprint,
    'dataset_lineage', r.dataset_lineage,
    'analysis_version', r.analysis_version,
    'reviewer_decision', r.reviewer_decision,
    'creation_timestamp', r.creation_timestamp,
    'reviewed_at', r.reviewed_at,
    'evidence_reference', r.evidence_reference,
    'created_at', r.created_at
  ) order by r.creation_timestamp desc)
  into v_rows
  from public.s08_frozen_reviews r
  where r.company_id = v_company_id
    and (p_period_id is null or r.accounting_period_id = p_period_id);

  return jsonb_build_object('company_id', v_company_id, 'reviews', coalesce(v_rows, '[]'::jsonb));
end;
$$;

-- Grants
revoke all on function public.s08_compute_dataset_fingerprint(uuid,uuid) from public, anon;
grant execute on function public.s08_compute_dataset_fingerprint(uuid,uuid) to authenticated, service_role;

revoke all on function public.s08_create_frozen_review(jsonb) from public, anon;
grant execute on function public.s08_create_frozen_review(jsonb) to authenticated, service_role;

revoke all on function public.s08_analyze_frozen_review(uuid,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.s08_analyze_frozen_review(uuid,jsonb,jsonb,jsonb) to authenticated, service_role;

revoke all on function public.s08_approve_frozen_review(uuid,text) from public, anon;
grant execute on function public.s08_approve_frozen_review(uuid,text) to authenticated, service_role;

revoke all on function public.s08_reject_frozen_review(uuid,text) from public, anon;
grant execute on function public.s08_reject_frozen_review(uuid,text) to authenticated, service_role;

revoke all on function public.s08_verify_fingerprint(uuid) from public, anon;
grant execute on function public.s08_verify_fingerprint(uuid) to authenticated, service_role;

revoke all on function public.s08_list_frozen_reviews(uuid) from public, anon;
grant execute on function public.s08_list_frozen_reviews(uuid) to authenticated, service_role;

commit;
