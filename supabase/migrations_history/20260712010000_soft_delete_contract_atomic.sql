-- ============================================================
-- FGR-004: Route softDeleteContract through soft_delete_contract_atomic
--
-- Problem: softDeleteContract(contractId) in contractService.ts performed
-- a direct client-side update `supabase.from('contracts').update({ deleted_at: ... })`.
-- This bypassed server-side role validation (`is_admin_or_manager()`), and
-- did not check whether the contract had paid invoices or active receipts,
-- which could orphan accounting transactions if an active/paid contract
-- was soft-deleted. Furthermore, if an active or draft contract without
-- payments was soft-deleted, future unpaid invoices remained active.
--
-- Solution: Add `soft_delete_contract_atomic(p_contract_id text)` SECURITY DEFINER RPC.
-- Enforces:
--   1. Caller must be authenticated and have `is_admin_or_manager()` role.
--   2. Rejects soft deletion if any paid invoices (`paid_amount > 0`) or
--      receipts exist for the contract (`contract_id`), instructing the user
--      to terminate the contract instead to preserve financial audit trail.
--   3. Automatically cancels and soft-deletes any unpaid future invoices
--      under the contract (`paid_amount = 0` and `due_date > current_date`),
--      preventing orphaned open receivables.
--   4. Sets `deleted_at = now()` and `updated_at = now()` on the contract row.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_contract_atomic(
  p_contract_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old public.contracts%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_or_manager() THEN
    RAISE EXCEPTION 'غير مصرح: يجب أن تكون مديراً أو مشرفاً لحذف عقد' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old
  FROM public.contracts
  WHERE id = p_contract_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'العقد غير موجود';
  END IF;

  -- Protect financial integrity: reject soft deletion if paid invoices exist
  IF EXISTS (
    SELECT 1 FROM public.invoices
    WHERE contract_id = p_contract_id
      AND deleted_at IS NULL
      AND COALESCE(paid_amount, 0) > 0
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف عقد يحتوي على فواتير مدفوعة أو دفعات مسجلة؛ يرجى إنهاء العقد بدلاً من ذلك';
  END IF;

  -- Protect financial integrity: reject soft deletion if receipts exist
  IF EXISTS (
    SELECT 1 FROM public.receipts
    WHERE contract_id = p_contract_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'لا يمكن حذف عقد يحتوي على إيصالات مالية؛ يرجى إنهاء العقد بدلاً من ذلك';
  END IF;

  -- Cancel and soft-delete future unpaid invoices so they do not remain open
  UPDATE public.invoices
  SET status = 'CANCELLED',
      deleted_at = now(),
      updated_at = now()
  WHERE contract_id = p_contract_id
    AND deleted_at IS NULL
    AND COALESCE(paid_amount, 0) = 0
    AND status NOT IN ('CANCELLED', 'PAID')
    AND due_date::date > current_date;

  -- Soft-delete the contract
  UPDATE public.contracts
  SET deleted_at = now(),
      updated_at = now()
  WHERE id = p_contract_id;

  RETURN jsonb_build_object(
    'status', 'deleted',
    'contract_id', p_contract_id
  );
END;
$$;

ALTER FUNCTION public.soft_delete_contract_atomic(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.soft_delete_contract_atomic(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_contract_atomic(text) TO authenticated, service_role;
