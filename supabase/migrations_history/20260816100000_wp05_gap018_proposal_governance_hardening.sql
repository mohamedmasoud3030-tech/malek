-- =============================================================================
-- WP-05 GAP-018 governance hardening
--
-- Closes four gaps in the variance-proposal lane before merge:
--   1. Regeneration after a changed diagnosis supersedes stale pending proposals
--      instead of colliding on (company, request, class).
--   2. Approval revalidates the frozen diagnosis and rejects stale evidence.
--   3. Proposal evidence / decision metadata cannot be mutated through the
--      internal authorization GUC outside a legitimate lifecycle transition.
--   4. The SECURITY DEFINER proof RPC derives tenant authority from JWT/session
--      identity, never from current_user (which is the function owner inside a
--      SECURITY DEFINER function).
--
-- This migration does not post, reverse, or mutate journal entries.
-- =============================================================================
begin;

-- One active pending proposal per request/class. Historical APPROVED, REJECTED,
-- and SUPERSEDED rows remain append-only evidence and no longer block a refreshed
-- diagnosis from being raised under the same deterministic request id.
drop index if exists public.wp05_correction_proposals_request_uidx;
create unique index wp05_correction_proposals_request_uidx
  on public.wp05_correction_proposals (company_id, request_id, reconciliation_class)
  where status = 'PENDING_APPROVAL';

create or replace function public.wp05_enforce_proposal_governance_hardening()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_diag record;
  v_existing record;
  v_supersede_note constant text := 'Superseded by a refreshed variance diagnosis before approval.';
begin
  if tg_op = 'INSERT' then
    -- The proposal register is a maker lane only. Even privileged callers cannot
    -- inject a pre-decided row and make it look governed.
    if new.status <> 'PENDING_APPROVAL' then
      raise exception 'WP05_PROPOSAL_INITIAL_STATE_INVALID: proposals must be created PENDING_APPROVAL'
        using errcode = '42501';
    end if;
    if new.maker_user_id is null then
      raise exception 'WP05_PROPOSAL_MAKER_REQUIRED: maker_user_id is required'
        using errcode = '42501';
    end if;
    if new.checker_user_id is not null
       or new.decided_at is not null
       or new.decision_note is not null
       or new.s09_correction_id is not null then
      raise exception 'WP05_PROPOSAL_INITIAL_DECISION_INVALID: new proposals cannot contain checker, decision or S09 linkage data'
        using errcode = '42501';
    end if;

    -- A supplied accounting period must belong to the same company AND contain
    -- the diagnostic cut-off date. This prevents a July finding being labelled
    -- as a different accounting period even through privileged paths.
    if new.accounting_period_id is not null and not exists (
      select 1
      from public.accounting_periods ap
      where ap.id = new.accounting_period_id
        and ap.company_id = new.company_id
        and new.as_of between ap.start_date and ap.end_date
    ) then
      raise exception 'WP05_PROPOSAL_PERIOD_SCOPE_INVALID: period must belong to the company and contain as_of %', new.as_of
        using errcode = '23514';
    end if;

    -- A changed diagnosis for the same cut-off/class replaces only the ACTIVE
    -- pending decision. The old row is retained as SUPERSEDED evidence.
    for v_existing in
      select p.id, p.request_id, p.reconciliation_class
      from public.wp05_correction_proposals p
      where p.company_id = new.company_id
        and p.as_of = new.as_of
        and p.reconciliation_class = new.reconciliation_class
        and p.account_no is not distinct from new.account_no
        and p.status = 'PENDING_APPROVAL'
        and p.idempotency_key <> new.idempotency_key
      for update
    loop
      perform set_config('malik.wp05_proposal_change_authorized', 'true', true);

      update public.wp05_correction_proposals
      set status = 'SUPERSEDED',
          checker_user_id = null,
          decided_at = now(),
          decision_note = v_supersede_note,
          updated_at = now()
      where id = v_existing.id;

      perform set_config('malik.wp05_proposal_change_authorized', 'false', true);

      insert into public.audit_log (
        id, ts, user_id, username, action, entity, entity_id, note, "table",
        details, created_at, old_value, new_value
      ) values (
        gen_random_uuid(), extract(epoch from now())::bigint, auth.uid(),
        (select email from auth.users where id = auth.uid()),
        'WP05_PROPOSAL_SUPERSEDED', 'wp05_correction_proposals', v_existing.id::text,
        v_supersede_note,
        'wp05_correction_proposals',
        format('request_id=%s; class=%s', v_existing.request_id, v_existing.reconciliation_class),
        now(),
        jsonb_build_object('status', 'PENDING_APPROVAL'),
        jsonb_build_object('status', 'SUPERSEDED', 'superseded_by_idempotency_key', new.idempotency_key)
      );
    end loop;

    return new;
  end if;

  -- The base guard already freezes company, scope, balances, evidence, maker and
  -- idempotency identity. Harden the remaining finding fields and period link.
  if old.accounting_period_id is distinct from new.accounting_period_id
     or old.reason_detail is distinct from new.reason_detail
     or old.proposal_type is distinct from new.proposal_type
     or old.recommended_action is distinct from new.recommended_action then
    raise exception 'WP05_PROPOSAL_IMMUTABLE_FIELD: period and finding metadata are immutable evidence'
      using errcode = '42501';
  end if;

  -- There is no governed S09-linking RPC in GAP-018. Until one exists, this link
  -- cannot be populated by an update that merely has the internal GUC set.
  if old.s09_correction_id is distinct from new.s09_correction_id then
    raise exception 'WP05_PROPOSAL_IMMUTABLE_FIELD: s09_correction_id requires a dedicated governed linkage path'
      using errcode = '42501';
  end if;

  if old.status = new.status then
    if old.checker_user_id is distinct from new.checker_user_id
       or old.decided_at is distinct from new.decided_at
       or old.decision_note is distinct from new.decision_note then
      raise exception 'WP05_PROPOSAL_DECISION_IMMUTABLE: decision metadata can change only with the PENDING_APPROVAL lifecycle transition'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if old.status <> 'PENDING_APPROVAL' then
    -- The base guard also enforces this; keeping it here makes the hardening
    -- invariant independent of trigger ordering.
    raise exception 'WP05_PROPOSAL_LIFECYCLE_TERMINAL: % is terminal', old.status
      using errcode = '23514';
  end if;

  if new.status = 'APPROVED' then
    if new.checker_user_id is null or new.decided_at is null then
      raise exception 'WP05_PROPOSAL_DECISION_INCOMPLETE: approval requires checker and decided_at'
        using errcode = '42501';
    end if;

    -- Approval is valid only while the exact frozen finding is still current.
    -- A same-size variance with changed underlying evidence is stale too.
    select * into v_diag
    from public.wp05_variance_diagnostics(new.company_id, new.as_of) d
    where d.reconciliation_class = new.reconciliation_class
      and d.account_no is not distinct from new.account_no
    limit 1;

    if not found
       or v_diag.reconciliation_status <> 'FAIL'
       or v_diag.reason_code is distinct from old.reason_code
       or v_diag.reason_detail is distinct from old.reason_detail
       or v_diag.proposal_type is distinct from old.proposal_type
       or v_diag.recommended_action is distinct from old.recommended_action
       or v_diag.subledger_balance is distinct from old.subledger_balance
       or v_diag.gl_balance is distinct from old.gl_balance
       or v_diag.variance is distinct from old.variance_amount
       or v_diag.evidence is distinct from old.evidence then
      raise exception 'WP05_PROPOSAL_STALE: diagnosis changed after proposal creation; regenerate before approval'
        using errcode = '23514';
    end if;

  elsif new.status = 'REJECTED' then
    if new.checker_user_id is null
       or new.decided_at is null
       or new.decision_note is null
       or btrim(new.decision_note) = '' then
      raise exception 'WP05_PROPOSAL_DECISION_INCOMPLETE: rejection requires checker, decided_at and a non-empty reason'
        using errcode = '42501';
    end if;

  elsif new.status = 'SUPERSEDED' then
    if new.checker_user_id is not null
       or new.decided_at is null
       or new.decision_note is null
       or btrim(new.decision_note) = '' then
      raise exception 'WP05_PROPOSAL_SUPERSEDE_INVALID: supersede requires decided_at/note and no checker'
        using errcode = '42501';
    end if;

  else
    raise exception 'WP05_PROPOSAL_LIFECYCLE_ILLEGAL: unsupported transition to %', new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists a_wp05_correction_proposal_governance_hardening on public.wp05_correction_proposals;
create trigger a_wp05_correction_proposal_governance_hardening
  before insert or update on public.wp05_correction_proposals
  for each row execute function public.wp05_enforce_proposal_governance_hardening();

revoke all on function public.wp05_enforce_proposal_governance_hardening() from public, anon, authenticated;

-- SECURITY DEFINER tenant-isolation hardening. current_user is intentionally not
-- used for authorization here: inside a SECURITY DEFINER function it resolves to
-- the function owner, not to the PostgREST caller role.
create or replace function public.wp05_assert_no_unapproved_correction_postings(
  p_company_id uuid default public.current_company_id()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_company_id uuid;
  v_actor_user_id uuid := auth.uid();
  v_jwt_role text := coalesce(auth.role(), '');
  v_proposal_batches int;
  v_unapproved_s09 int;
  v_pending int;
  v_approved int;
  v_rejected int;
  v_offenders jsonb;
begin
  if v_actor_user_id is not null then
    if not public.is_app_user() then
      raise exception 'WP05_PROOF_APP_USER_REQUIRED: active app user required'
        using errcode = '42501';
    end if;

    v_company_id := public.require_company_id();
    if p_company_id is not null and p_company_id <> v_company_id then
      raise exception 'WP05_COMPANY_ISOLATION_VIOLATION'
        using errcode = '42501';
    end if;
  elsif v_jwt_role = 'service_role' or session_user in ('postgres', 'supabase_admin') then
    v_company_id := coalesce(p_company_id, public.current_company_id());
  else
    raise exception 'WP05_PROOF_AUTH_REQUIRED: authenticated app user or service role required'
      using errcode = '42501';
  end if;

  if v_company_id is null then
    raise exception 'WP05_PROOF_COMPANY_REQUIRED: company_id required'
      using errcode = '22023';
  end if;

  select count(*)::int into v_proposal_batches
  from public.journal_batches jb
  where jb.company_id = v_company_id
    and jb.source_type in ('wp05_correction_proposal', 'wp05_variance_correction');

  select count(*)::int into v_unapproved_s09
  from public.s09_corrections c
  join public.s08_frozen_reviews r on r.id = c.review_id
  where c.company_id = v_company_id
    and c.status = 'APPLIED'
    and r.reviewer_decision is distinct from 'APPROVED';

  select
    count(*) filter (where status = 'PENDING_APPROVAL')::int,
    count(*) filter (where status = 'APPROVED')::int,
    count(*) filter (where status = 'REJECTED')::int
  into v_pending, v_approved, v_rejected
  from public.wp05_correction_proposals
  where company_id = v_company_id;

  select coalesce(
    jsonb_agg(jsonb_build_object(
      'batch_id', jb.id,
      'source_type', jb.source_type,
      'source_id', jb.source_id
    )),
    '[]'::jsonb
  )
  into v_offenders
  from public.journal_batches jb
  where jb.company_id = v_company_id
    and jb.source_type in ('wp05_correction_proposal', 'wp05_variance_correction');

  return jsonb_build_object(
    'success', (v_proposal_batches = 0 and v_unapproved_s09 = 0),
    'company_id', v_company_id,
    'proposal_sourced_gl_batches', v_proposal_batches,
    'applied_s09_without_approved_s08', v_unapproved_s09,
    'proposals_pending_approval', v_pending,
    'proposals_approved', v_approved,
    'proposals_rejected', v_rejected,
    'offending_batches', v_offenders
  );
end;
$$;

revoke all on function public.wp05_assert_no_unapproved_correction_postings(uuid) from public, anon;
grant execute on function public.wp05_assert_no_unapproved_correction_postings(uuid) to authenticated, service_role;

comment on function public.wp05_assert_no_unapproved_correction_postings(uuid) is
  'WP-05 GAP-018: tenant-safe proof that no proposal lane posted to GL and APPLIED S09 corrections trace to approved S08 reviews. SECURITY DEFINER authority is derived from JWT/session identity, never current_user.';

commit;
