-- Sensitive RPC authorization hardening (governance stabilization, Phase 4).
--
-- Preserves the real, working financial business logic of
-- post_receipt_atomic, execute_receipt_void_internal, and
-- import_bank_statement_batch_atomic exactly as-is. Only their
-- authorization checks change:
--
--   - post_receipt_atomic and execute_receipt_void_internal inlined a raw
--     `public.users.role IN ('ADMIN','MANAGER')` check. That is the same
--     defect being removed everywhere else in this stabilization: users.role
--     must never be an operational authorization source. Both are rewritten
--     to use public.is_admin_or_manager(), which (as of migration
--     20260901000012) resolves through active_company_role() and therefore
--     company_members.role for a validated active membership.
--
--   - import_bank_statement_batch_atomic previously had no direct
--     authorization check of its own; it was protected only transitively,
--     by unconditionally calling preview_bank_statement_batch_atomic (which
--     does check is_admin_or_manager()) before performing any write. That is
--     fragile: a future edit removing or reordering the preview call would
--     silently drop authorization with no local signal. This migration adds
--     an explicit, direct is_admin_or_manager() check at the top of the
--     function body, so authorization does not depend on call order or on
--     another function's internals.
--
-- No RPC signature, grant, or business/financial behavior changes. This is
-- an authorization-only patch to real, already-deployed implementations.
-- No _internal wrapper functions are introduced; the real bodies are edited
-- in place.
--
-- To make preservation mechanically enforceable, this migration reads each
-- deployed definition with pg_get_functiondef(), replaces only the exact
-- known authorization fragment, and fails closed if neither the expected old
-- nor already-hardened fragment is present. CREATE OR REPLACE is then executed
-- against that same definition, preserving the rest of each function body,
-- signature, owner, and existing grants.

begin;

DO $phase4$
DECLARE
  v_sql text;
  v_old text := $old$
  IF NOT EXISTS (
    SELECT 1
    FROM public.users AS app_user
    WHERE app_user.id = auth.uid()
      AND app_user.role::text IN ('ADMIN', 'MANAGER')
      AND app_user.status::text = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول'
      USING ERRCODE = '42501';
  END IF;$old$;
  v_new text := $new$
  IF NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'غير مصرح: هذه العملية متاحة فقط للمدير أو المسؤول'
      USING ERRCODE = '42501';
  END IF;$new$;
BEGIN
  SELECT pg_get_functiondef('public.post_receipt_atomic(jsonb)'::regprocedure)
    INTO v_sql;

  IF position(v_old IN v_sql) > 0 THEN
    v_sql := replace(v_sql, v_old, v_new);
    EXECUTE v_sql;
  ELSIF position(v_new IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 4 refused to patch post_receipt_atomic: expected authorization block not found.';
  END IF;
END
$phase4$;

DO $phase4$
DECLARE
  v_sql text;
  v_old text := $old$
  IF v_actor_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_actor_id
      AND u.status::text = 'ACTIVE'
      AND u.role::text IN ('ADMIN', 'MANAGER')
  ) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to void receipts.'
      USING ERRCODE = '42501';
  END IF;$old$;
  v_new text := $new$
  IF v_actor_id IS NULL OR NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to void receipts.'
      USING ERRCODE = '42501';
  END IF;$new$;
BEGIN
  SELECT pg_get_functiondef('public.execute_receipt_void_internal(jsonb)'::regprocedure)
    INTO v_sql;

  IF position(v_old IN v_sql) > 0 THEN
    v_sql := replace(v_sql, v_old, v_new);
    EXECUTE v_sql;
  ELSIF position(v_new IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 4 refused to patch execute_receipt_void_internal: expected authorization block not found.';
  END IF;
END
$phase4$;

DO $phase4$
DECLARE
  v_sql text;
  v_anchor text := $old$  -- Authoritative preview first: validates, never writes, detects content reuse.
  v_preview := public.preview_bank_statement_batch_atomic(payload);$old$;
  v_hardened_anchor text := $new$  IF NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'Only managers can import bank statements.'
      USING ERRCODE = '42501';
  END IF;

  -- Authoritative preview first: validates, never writes, detects content reuse.
  v_preview := public.preview_bank_statement_batch_atomic(payload);$new$;
BEGIN
  SELECT pg_get_functiondef('public.import_bank_statement_batch_atomic(jsonb)'::regprocedure)
    INTO v_sql;

  IF position(v_anchor IN v_sql) > 0 THEN
    v_sql := replace(v_sql, v_anchor, v_hardened_anchor);
    EXECUTE v_sql;
  ELSIF position(v_hardened_anchor IN v_sql) = 0 THEN
    RAISE EXCEPTION 'Phase 4 refused to patch import_bank_statement_batch_atomic: expected preview anchor not found.';
  END IF;
END
$phase4$;

commit;
