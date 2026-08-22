import { useMemo, useState } from 'react';
import { formatMoney as formatCurrencyMoney, normalizeCurrency } from '@/lib/formatters';
import { getTodayLocalDateString } from '@/features/reports/reports-page.helpers';
import { useDocumentSettings } from '@/features/settings/useDocumentSettings';
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  approveDepositClaim,
  applyDepositClaim,
  createDepositClaim,
  createTenantDeposit,
  refundDepositGoverned,
  rejectDepositClaim,
  reverseDepositClaim,
  reverseDepositRefund,
  type DepositClaimCreatePayload,
  type DepositClaimRecord,
  type DepositRefundEventRecord,
  type DepositRecord,
  type DepositRefundPayload,
} from './deposit-service';
import {
  useContracts,
  useDepositClaims,
  useDepositInvoices,
  useDepositRefundEvents,
  useReviewedMoveOutInspections,
  useTenantDeposits,
} from './deposit-workspace-queries';

function getContentStatus(isLoading: boolean, isError: boolean, isEmpty: boolean) {
  if (isLoading) return 'loading' as const;
  if (isError) return 'error' as const;
  if (isEmpty) return 'empty' as const;
  return 'ready' as const;
}

export type DepositActionType = 'claim' | 'refund' | 'rejectClaim' | 'reverseClaim' | 'reverseRefund' | 'create' | null;

export function useDepositWorkspaceController() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id ?? '';

  const [selectedDeposit, setSelectedDeposit] = useState<DepositRecord | null>(null);
  const [selectedClaim, setSelectedClaim] = useState<DepositClaimRecord | null>(null);
  const [selectedRefundEvent, setSelectedRefundEvent] = useState<DepositRefundEventRecord | null>(null);
  const [actionType, setActionType] = useState<DepositActionType>(null);
  const [amountInput, setAmountInput] = useState<number>(0);
  const [claimKindInput, setClaimKindInput] = useState<DepositClaimCreatePayload['claim_kind']>('DAMAGE');
  const [invoiceInput, setInvoiceInput] = useState('');
  const [evidenceInput, setEvidenceInput] = useState('');
  const [inspectionInput, setInspectionInput] = useState('');
  const [claimNoteInput, setClaimNoteInput] = useState('');
  const [reasonInput, setReasonInput] = useState('');
  const [paymentMethodInput, setPaymentMethodInput] = useState<DepositRefundPayload['payment_method']>('bank_transfer');
  const [createForm, setCreateForm] = useState({
    contract_id: '',
    amount: 0,
    received_date: getTodayLocalDateString(),
    notes: '',
  });

  const depositsQuery = useTenantDeposits();
  const claimsQuery = useDepositClaims();
  const refundEventsQuery = useDepositRefundEvents();
  const contractsQuery = useContracts();
  const invoicesQuery = useDepositInvoices(selectedDeposit?.contract_id);
  const moveOutInspectionsQuery = useReviewedMoveOutInspections(selectedDeposit?.contract_id);
  const documentSettings = useDocumentSettings();

  const deposits = depositsQuery.data ?? [];
  const claims = claimsQuery.data ?? [];
  const refundEvents = refundEventsQuery.data ?? [];
  const selectedContract = contractsQuery.data?.find((c) => c.id === createForm.contract_id) ?? null;
  const currencyCode = normalizeCurrency(documentSettings.companySettings.currency);
  const currencyLabel = documentSettings.companySettings.currencySymbol || currencyCode;
  const formatDepositMoney = (value: number) =>
    formatCurrencyMoney({ amount: value, currency: currencyCode, locale: 'ar' });

  const invalidateFinancial = () => {
    void queryClient.invalidateQueries({ queryKey: ['tenant-deposits'] });
    void queryClient.invalidateQueries({ queryKey: ['deposit-claims'] });
    void queryClient.invalidateQueries({ queryKey: ['deposit-refund-events'] });
  };

  const createMut = useMutation({
    mutationFn: () =>
      createTenantDeposit({
        contract_id: createForm.contract_id,
        amount: createForm.amount,
        received_date: createForm.received_date,
        notes: createForm.notes || null,
        request_id: crypto.randomUUID(),
      }),
    onSuccess: () => {
      toast.success('تم تسجيل وديعة التأمين بنجاح');
      setActionType(null);
      setCreateForm({ contract_id: '', amount: 0, received_date: getTodayLocalDateString(), notes: '' });
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء الوديعة'),
  });

  const claimMut = useMutation({
    mutationFn: () => {
      if (!selectedDeposit) throw new Error('لا توجد وديعة محددة');
      return createDepositClaim({
        deposit_id: selectedDeposit.id,
        claim_kind: claimKindInput,
        invoice_id: claimKindInput === 'INVOICE_ARREARS' ? invoiceInput || null : null,
        allocation_amount: amountInput,
        evidence_uri: evidenceInput,
        inspection_id: claimKindInput === 'DAMAGE' ? inspectionInput || null : null,
        claim_note: claimNoteInput || null,
        request_id: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      toast.success('تم إنشاء طلب التخصيص — بانتظار اعتماد مدقق آخر');
      setSelectedDeposit(null);
      setActionType(null);
      setAmountInput(0);
      setEvidenceInput('');
      setInspectionInput('');
      setClaimNoteInput('');
      setInvoiceInput('');
      void queryClient.invalidateQueries({ queryKey: ['deposit-claims'] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إنشاء الطلب'),
  });

  const approveMut = useMutation({
    mutationFn: (claim: DepositClaimRecord) => approveDepositClaim(claim.id),
    onSuccess: () => {
      toast.success('تم اعتماد الطلب');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر الاعتماد'),
  });

  const applyMut = useMutation({
    mutationFn: (claim: DepositClaimRecord) => applyDepositClaim(claim.id),
    onSuccess: () => {
      toast.success('تم تطبيق التخصيص على الحسابات والفواتير');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر تطبيق التخصيص'),
  });

  const rejectMut = useMutation({
    mutationFn: () => {
      if (!selectedClaim) throw new Error('لا يوجد طلب محدد');
      return rejectDepositClaim(selectedClaim.id, reasonInput);
    },
    onSuccess: () => {
      toast.success('تم رفض الطلب');
      setSelectedClaim(null);
      setActionType(null);
      setReasonInput('');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر رفض الطلب'),
  });

  const reverseClaimMut = useMutation({
    mutationFn: () => {
      if (!selectedClaim) throw new Error('لا يوجد طلب محدد');
      return reverseDepositClaim(selectedClaim.id, reasonInput);
    },
    onSuccess: () => {
      toast.success('تم إلغاء التخصيص بقيد تعويضي');
      setSelectedClaim(null);
      setActionType(null);
      setReasonInput('');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إلغاء التخصيص'),
  });

  const refundMut = useMutation({
    mutationFn: () => {
      if (!selectedDeposit) throw new Error('لا توجد وديعة محددة');
      return refundDepositGoverned({
        deposit_id: selectedDeposit.id,
        refund_amount: amountInput,
        payment_method: paymentMethodInput,
        refund_date: getTodayLocalDateString(),
        notes: claimNoteInput || null,
        request_id: crypto.randomUUID(),
      });
    },
    onSuccess: () => {
      toast.success('تم رد مبلغ التأمين');
      setSelectedDeposit(null);
      setActionType(null);
      setAmountInput(0);
      setClaimNoteInput('');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر الاسترداد - تحقق من الرصيد'),
  });

  const reverseRefundMut = useMutation({
    mutationFn: () => {
      if (!selectedRefundEvent) throw new Error('لا يوجد حدث استرداد محدد');
      return reverseDepositRefund(selectedRefundEvent.id, reasonInput);
    },
    onSuccess: () => {
      toast.success('تم إلغاء الاسترداد بقيد تعويضي');
      setSelectedRefundEvent(null);
      setActionType(null);
      setReasonInput('');
      invalidateFinancial();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'تعذر إلغاء الاسترداد'),
  });

  const totalHeld = useMemo(() => deposits.reduce((sum, d) => sum + d.remaining_amount, 0), [deposits]);
  const totalDeductions = useMemo(() => deposits.reduce((sum, d) => sum + d.deducted_amount, 0), [deposits]);
  const totalRefunded = useMemo(() => deposits.reduce((sum, d) => sum + d.refunded_amount, 0), [deposits]);
  const contentStatus = getContentStatus(depositsQuery.isLoading, depositsQuery.isError, deposits.length === 0);

  const openDepositAction = (deposit: DepositRecord, type: 'claim' | 'refund') => {
    setSelectedDeposit(deposit);
    setActionType(type);
    setAmountInput(deposit.remaining_amount);
    setClaimNoteInput('');
    setEvidenceInput('');
    setInvoiceInput('');
    setClaimKindInput('DAMAGE');
  };

  const closeAll = () => {
    setActionType(null);
    setSelectedDeposit(null);
    setSelectedClaim(null);
    setSelectedRefundEvent(null);
  };

  const openRejectClaim = (claim: DepositClaimRecord) => {
    setSelectedClaim(claim);
    setActionType('rejectClaim');
    setReasonInput('');
  };

  const openReverseClaim = (claim: DepositClaimRecord) => {
    setSelectedClaim(claim);
    setActionType('reverseClaim');
    setReasonInput('');
  };

  const openReverseRefund = (event: DepositRefundEventRecord) => {
    setSelectedRefundEvent(event);
    setActionType('reverseRefund');
    setReasonInput('');
  };

  return {
    // queries
    depositsQuery,
    claimsQuery,
    refundEventsQuery,
    contractsQuery,
    invoicesQuery,
    moveOutInspectionsQuery,
    documentSettings,
    // data
    deposits,
    claims,
    refundEvents,
    selectedContract,
    currencyCode,
    currencyLabel,
    formatDepositMoney,
    currentUserId,
    // selection
    selectedDeposit,
    setSelectedDeposit,
    selectedClaim,
    setSelectedClaim,
    selectedRefundEvent,
    setSelectedRefundEvent,
    actionType,
    setActionType,
    // inputs
    amountInput,
    setAmountInput,
    claimKindInput,
    setClaimKindInput,
    invoiceInput,
    setInvoiceInput,
    evidenceInput,
    setEvidenceInput,
    inspectionInput,
    setInspectionInput,
    claimNoteInput,
    setClaimNoteInput,
    reasonInput,
    setReasonInput,
    paymentMethodInput,
    setPaymentMethodInput,
    createForm,
    setCreateForm,
    // derived
    totalHeld,
    totalDeductions,
    totalRefunded,
    contentStatus,
    // actions
    openDepositAction,
    closeAll,
    openRejectClaim,
    openReverseClaim,
    openReverseRefund,
    // mutations
    createMut,
    claimMut,
    approveMut,
    applyMut,
    rejectMut,
    reverseClaimMut,
    refundMut,
    reverseRefundMut,
  };
}
