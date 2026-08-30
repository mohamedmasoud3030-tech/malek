-- Close the browser EXECUTE boundary on internal GL posting primitives and
-- their internal helpers.
--
-- Defect (P0, security): after the canonical baseline + ACL-lock migrations,
-- these SECURITY DEFINER functions remained executable by `authenticated`
-- even though they are internal posting/helper primitives, not browser RPCs:
--
--   * the ten gl_* posting primitives post journal batches for a
--     company_id taken from the CALLER-SUPPLIED payload with no
--     authentication, role, or caller-company validation of their own
--     (proven: a VIEWER member of company A can post a journal batch into
--     company B's general ledger);
--   * owner_settlement_reservable_* / require_company_account_id /
--     gl_validate_and_normalize_lines / assert_* helpers take a company uuid
--     from the caller and, running as SECURITY DEFINER (bypassing RLS), can
--     disclose another company's financial aggregates or account identity;
--   * check_unit_maintenance_block(p_unit_id) returns maintenance request
--     details for any unit id in any company with no authorization.
--
-- Intended behavior (DATABASE_RULES.md): "Internal/service-only SECURITY
-- DEFINER functions keep minimum EXECUTE grants" and "Browser/direct writes
-- to protected financial tables are forbidden." Migration 00020/00028 already
-- established this exact boundary for post_journal_event, gl_create_journal_batch,
-- gl_post_journal_batch and reverse_journal_batch; these functions were left
-- out of that inventory.
--
-- Safety of this change:
--   * No function body, business logic, table, RLS policy or data changes.
--   * No frontend runtime caller and no frontend database-contract entry
--     references any of these functions (verified by scan).
--   * All internal callers are SECURITY DEFINER functions (EXECUTE is checked
--     against the owner, not the browser role) or service-role jobs, so the
--     governed flows that call them keep working.
--   * Statements are idempotent (revoke/grant only).

begin;

-- Internal GL posting primitives: post_journal_event-based financial posting
-- for a caller-supplied company. Service-role only.
revoke all on function public.gl_ml_post_sublease_receipt(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_accrue_fixed_monthly_fee(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_post_broker_commission_approval(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_post_broker_commission_payment(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_post_collection_office_is_creditor(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_post_collection_owner_is_creditor(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_post_deposit_receipt(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_post_invoice_office_is_creditor(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_post_owner_expense(jsonb) from public, anon, authenticated;
revoke all on function public.gl_pm_post_owner_payment(jsonb) from public, anon, authenticated;

-- Internal GL validation/normalization helper invoked by the posting engine.
revoke all on function public.gl_validate_and_normalize_lines(uuid, jsonb) from public, anon, authenticated;

-- Internal owner-settlement financial projections (SECURITY DEFINER reads that
-- bypass RLS for a caller-supplied company uuid).
revoke all on function public.owner_settlement_reservable_expenses(uuid, uuid, date, date, text) from public, anon, authenticated;
revoke all on function public.owner_settlement_reservable_payments(uuid, uuid, date, date, text) from public, anon, authenticated;

-- Internal invariant/maintenance helpers (cross-company oracles / scans).
revoke all on function public.assert_owner_funds_event_cutover(uuid, date, uuid) from public, anon, authenticated;
revoke all on function public.assert_owner_settlement_links_backfillable() from public, anon, authenticated;
revoke all on function public.contract_evidence_assert_documents(uuid, uuid, uuid[]) from public, anon, authenticated;

-- Internal account resolver used by posting paths.
revoke all on function public.require_company_account_id(uuid, text) from public, anon, authenticated;

-- Unscoped cross-company maintenance read helper.
revoke all on function public.check_unit_maintenance_block(uuid) from public, anon, authenticated;

-- Re-assert the service-role boundary explicitly so the deployed ACL is the
-- intended terminal state, not an accident of defaults.
grant execute on function public.gl_ml_post_sublease_receipt(jsonb) to service_role;
grant execute on function public.gl_pm_accrue_fixed_monthly_fee(jsonb) to service_role;
grant execute on function public.gl_pm_post_broker_commission_approval(jsonb) to service_role;
grant execute on function public.gl_pm_post_broker_commission_payment(jsonb) to service_role;
grant execute on function public.gl_pm_post_collection_office_is_creditor(jsonb) to service_role;
grant execute on function public.gl_pm_post_collection_owner_is_creditor(jsonb) to service_role;
grant execute on function public.gl_pm_post_deposit_receipt(jsonb) to service_role;
grant execute on function public.gl_pm_post_invoice_office_is_creditor(jsonb) to service_role;
grant execute on function public.gl_pm_post_owner_expense(jsonb) to service_role;
grant execute on function public.gl_pm_post_owner_payment(jsonb) to service_role;
grant execute on function public.gl_validate_and_normalize_lines(uuid, jsonb) to service_role;
grant execute on function public.owner_settlement_reservable_expenses(uuid, uuid, date, date, text) to service_role;
grant execute on function public.owner_settlement_reservable_payments(uuid, uuid, date, date, text) to service_role;
grant execute on function public.assert_owner_funds_event_cutover(uuid, date, uuid) to service_role;
grant execute on function public.assert_owner_settlement_links_backfillable() to service_role;
grant execute on function public.contract_evidence_assert_documents(uuid, uuid, uuid[]) to service_role;
grant execute on function public.require_company_account_id(uuid, text) to service_role;
grant execute on function public.check_unit_maintenance_block(uuid) to service_role;

notify pgrst, 'reload schema';
commit;
