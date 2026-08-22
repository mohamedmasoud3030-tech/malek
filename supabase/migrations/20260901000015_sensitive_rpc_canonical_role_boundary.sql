-- MALEK governance stabilization — Phase 4 corrective forward migration.
--
-- Preserve the historical ADMIN/MANAGER authorization semantics of the
-- sensitive financial engines while changing the source of truth to the
-- canonical company-membership resolver established in 00012.
--
-- Why this forward correction exists:
--   00013 correctly removed users.role and phantom-wrapper risk, but mapped
--   some historical ADMIN/MANAGER checks to permission tokens. Because the
--   permission matrix can grant those tokens to other roles, that can widen a
--   sensitive RPC boundary. The Phase 4 acceptance matrix intentionally proves
--   that active ADMIN/MANAGER membership remains the boundary.
--
-- This migration patches only authorization preambles in the real existing
-- functions. Business logic, return values, idempotency, financial posting,
-- company scoping, trigger wiring, ownership and deployed EXECUTE ACLs remain
-- unchanged.

begin;

-- ---------------------------------------------------------------------------
-- Bank statement preview: restore the original ADMIN/MANAGER semantics through
-- the now-canonical is_admin_or_manager() helper.
-- ---------------------------------------------------------------------------
do $phase4_preview_role_boundary$
declare
  v_signature constant text := 'public.preview_bank_statement_batch_atomic(jsonb)';
  v_oid oid := to_regprocedure(v_signature);
  v_definition text;
  v_hardened text;
  v_old constant text := $old$  if not coalesce(public.current_user_has_effective_app_permission('financial.bank_reconciliation.view'), false) then
    raise exception 'financial.bank_reconciliation.view is required.' using errcode = '42501';
  end if;
$old$;
  v_new constant text := $new$  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Only managers can import bank statements.' using errcode = '42501';
  end if;
$new$;
begin
  if v_oid is null then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: missing %', v_signature;
  end if;
  select pg_get_functiondef(v_oid) into v_definition;

  if position('financial.bank_reconciliation.view is required.' in v_definition) > 0 then
    v_hardened := replace(v_definition, v_old, v_new);
    if v_hardened = v_definition then
      raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: expected preview permission preamble not found in %', v_signature;
    end if;
    execute v_hardened;
  elsif position('is_admin_or_manager()' in v_definition) = 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: preview has neither expected permission gate nor canonical ADMIN/MANAGER gate';
  end if;

  select pg_get_functiondef(to_regprocedure(v_signature)) into v_definition;
  if position('is_admin_or_manager()' in v_definition) = 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: preview canonical ADMIN/MANAGER gate missing after patch';
  end if;
end
$phase4_preview_role_boundary$;

-- ---------------------------------------------------------------------------
-- Bank statement import: preserve the real preview delegation and require the
-- same active ADMIN/MANAGER membership before any import mutation.
-- ---------------------------------------------------------------------------
do $phase4_import_role_boundary$
declare
  v_signature constant text := 'public.import_bank_statement_batch_atomic(jsonb)';
  v_oid oid := to_regprocedure(v_signature);
  v_definition text;
  v_hardened text;
  v_old constant text := $old$  if auth.uid() is null or not coalesce(public.is_app_user(), false) then
    raise exception 'Authenticated app user is required.' using errcode = '42501';
  end if;
  if not coalesce(public.current_user_has_effective_app_permission('financial.bank_reconciliation.match'), false) then
    raise exception 'financial.bank_reconciliation.match is required.' using errcode = '42501';
  end if;
$old$;
  v_new constant text := $new$  if auth.uid() is null or not coalesce(public.is_admin_or_manager(), false) then
    raise exception 'Only managers can import bank statements.' using errcode = '42501';
  end if;
$new$;
begin
  if v_oid is null then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: missing %', v_signature;
  end if;
  select pg_get_functiondef(v_oid) into v_definition;

  if position('financial.bank_reconciliation.match is required.' in v_definition) > 0 then
    v_hardened := replace(v_definition, v_old, v_new);
    if v_hardened = v_definition then
      raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: expected import permission preamble not found in %', v_signature;
    end if;
    execute v_hardened;
  elsif position('is_admin_or_manager()' in v_definition) = 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: import has neither expected permission gate nor canonical ADMIN/MANAGER gate';
  end if;

  select pg_get_functiondef(to_regprocedure(v_signature)) into v_definition;
  if position('is_admin_or_manager()' in v_definition) = 0
     or position('preview_bank_statement_batch_atomic(payload)' in v_definition) = 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: import postcondition failed';
  end if;
end
$phase4_import_role_boundary$;

-- ---------------------------------------------------------------------------
-- Receipt posting engine: keep its original ADMIN/MANAGER boundary while using
-- the canonical membership-backed helper instead of users.role/permission
-- expansion.
-- ---------------------------------------------------------------------------
do $phase4_post_receipt_role_boundary$
declare
  v_signature constant text := 'public.post_receipt_atomic(jsonb)';
  v_oid oid := to_regprocedure(v_signature);
  v_definition text;
  v_hardened text;
  v_old constant text := $old$  IF auth.uid() IS NULL OR NOT coalesce(public.is_app_user(), false) THEN
    RAISE EXCEPTION 'Authenticated app user is required.' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(public.current_user_has_effective_app_permission('financial.payments.create'), false) THEN
    RAISE EXCEPTION 'financial.payments.create is required.' USING ERRCODE = '42501';
  END IF;
$old$;
  v_new constant text := $new$  IF auth.uid() IS NULL OR NOT coalesce(public.is_admin_or_manager(), false) THEN
    RAISE EXCEPTION 'ADMIN or MANAGER role is required to post receipts.' USING ERRCODE = '42501';
  END IF;
$new$;
begin
  if v_oid is null then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: missing %', v_signature;
  end if;
  select pg_get_functiondef(v_oid) into v_definition;

  if position('financial.payments.create is required.' in v_definition) > 0 then
    v_hardened := replace(v_definition, v_old, v_new);
    if v_hardened = v_definition then
      raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: expected post_receipt permission preamble not found in %', v_signature;
    end if;
    execute v_hardened;
  elsif position('is_admin_or_manager()' in v_definition) = 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: post_receipt has neither expected permission gate nor canonical ADMIN/MANAGER gate';
  end if;

  select pg_get_functiondef(to_regprocedure(v_signature)) into v_definition;
  if position('is_admin_or_manager()' in v_definition) = 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: post_receipt canonical ADMIN/MANAGER gate missing after patch';
  end if;
  if position('app_user.role::text IN (''ADMIN'', ''MANAGER'')' in v_definition) > 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: legacy users.role check remains in post_receipt';
  end if;
end
$phase4_post_receipt_role_boundary$;

-- ---------------------------------------------------------------------------
-- Internal receipt VOID executor: this real engine was already service/internal
-- only at the ACL boundary, but its defense-in-depth body still read users.role.
-- Replace only that condition with the canonical membership-backed helper.
-- ---------------------------------------------------------------------------
do $phase4_void_internal_role_boundary$
declare
  v_signature constant text := 'public.execute_receipt_void_internal(jsonb)';
  v_oid oid := to_regprocedure(v_signature);
  v_definition text;
  v_hardened text;
  v_old constant text := $old$  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = v_actor_id
      AND u.status::text = 'ACTIVE'
      AND u.role::text IN ('ADMIN', 'MANAGER')
  ) THEN
$old$;
  v_new constant text := $new$  IF auth.uid() IS NULL OR NOT coalesce(public.is_admin_or_manager(), false) THEN
$new$;
begin
  if v_oid is null then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: missing %', v_signature;
  end if;
  select pg_get_functiondef(v_oid) into v_definition;

  if position('u.role::text IN (''ADMIN'', ''MANAGER'')' in v_definition) > 0 then
    v_hardened := replace(v_definition, v_old, v_new);
    if v_hardened = v_definition then
      raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: expected execute_receipt_void_internal users.role condition not found';
    end if;
    execute v_hardened;
  elsif position('is_admin_or_manager()' in v_definition) = 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: execute_receipt_void_internal has neither legacy nor canonical ADMIN/MANAGER gate';
  end if;

  select pg_get_functiondef(to_regprocedure(v_signature)) into v_definition;
  if position('is_admin_or_manager()' in v_definition) = 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: execute_receipt_void_internal canonical ADMIN/MANAGER gate missing after patch';
  end if;
  if position('u.role::text IN (''ADMIN'', ''MANAGER'')' in v_definition) > 0 then
    raise exception 'PHASE4_ROLE_BOUNDARY_ABORT: legacy users.role check remains in execute_receipt_void_internal';
  end if;
end
$phase4_void_internal_role_boundary$;

-- Re-assert deployed ACL boundaries; no browser exposure is introduced.
revoke all on function public.preview_bank_statement_batch_atomic(jsonb) from public, anon;
grant execute on function public.preview_bank_statement_batch_atomic(jsonb) to authenticated, service_role;

revoke all on function public.import_bank_statement_batch_atomic(jsonb) from public, anon;
grant execute on function public.import_bank_statement_batch_atomic(jsonb) to authenticated, service_role;

revoke all on function public.post_receipt_atomic(jsonb) from public, anon, authenticated;
grant execute on function public.post_receipt_atomic(jsonb) to service_role;

revoke all on function public.execute_receipt_void_internal(jsonb) from public, anon, authenticated;

commit;
