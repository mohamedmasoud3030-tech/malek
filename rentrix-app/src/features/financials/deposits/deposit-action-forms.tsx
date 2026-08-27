import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { getActionableSupabaseErrorMessage } from '@/lib/supabase-error';
import { describeSelectedContract, formatContractOptionLabel } from './deposit-contract-options';
import { depositClaimKindLabels, type DepositClaimCreatePayload, type DepositRefundPayload } from './deposit-service';
import type { useDepositWorkspaceController } from './use-deposit-workspace-controller';

type Controller = ReturnType<typeof useDepositWorkspaceController>;

function depositErrorMessage(error: unknown, fallback: string) {
  return error ? getActionableSupabaseErrorMessage(error, fallback) : undefined;
}

export function DepositCreateForm({ controller }: { controller: Controller }) {
  const {
    actionType,
    setActionType,
    createForm,
    setCreateForm,
    contractsQuery,
    selectedContract,
    currencyCode,
    createMut,
  } = controller;

  return (
    <EntityForm.Overlay
      open={actionType === 'create'}
      onOpenChange={(open) => {
        if (!open && !createMut.isPending) setActionType(null);
      }}
      title="تسجيل وديعة تأمين جديدة"
      description="سيتم تسجيل الوديعة وربطها بالعقد، ويتولى النظام تحديث أثرها المالي تلقائيًا."
      visualVariant="operational"
    >
      <EntityForm.Root
        aria-busy={createMut.isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (!createForm.contract_id || createForm.amount <= 0 || !createForm.received_date) return;
          createMut.mutate();
        }}
      >
        <EntityForm.ErrorSummary message={createMut.isError ? depositErrorMessage(createMut.error, 'تعذر حفظ وديعة التأمين.') : undefined} />
        <EntityForm.Section title="بيانات الوديعة">
          <EntityForm.Field label="العقد النشط *">
            <Select
              required
              value={createForm.contract_id}
              onChange={(event) => setCreateForm((form) => ({ ...form, contract_id: event.target.value }))}
            >
              <option value="">اختر العقد</option>
              {contractsQuery.data?.map((contract) => (
                <option key={contract.id} value={contract.id}>
                  {formatContractOptionLabel(contract)}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
          {selectedContract ? (
            <p className="rounded-xl bg-muted/35 p-3 text-xs font-medium leading-5 text-muted-foreground">
              العقد المحدد: {describeSelectedContract(selectedContract)}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <EntityForm.Field label={`المبلغ (${currencyCode}) *`}>
              <Input
                required
                type="number"
                min="0.001"
                step="0.001"
                inputMode="decimal"
                dir="ltr"
                value={createForm.amount}
                onChange={(event) => setCreateForm((form) => ({ ...form, amount: Number(event.target.value) || 0 }))}
              />
            </EntityForm.Field>
            <EntityForm.Field label="تاريخ الاستلام *">
              <Input
                required
                type="date"
                value={createForm.received_date}
                onChange={(event) => setCreateForm((form) => ({ ...form, received_date: event.target.value }))}
              />
            </EntityForm.Field>
          </div>
          <EntityForm.Field label="ملاحظات">
            <Input
              value={createForm.notes}
              onChange={(event) => setCreateForm((form) => ({ ...form, notes: event.target.value }))}
              placeholder="ملاحظات الاستلام..."
            />
          </EntityForm.Field>
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel={createMut.isPending ? 'جارٍ الحفظ...' : 'حفظ الوديعة'}
          onCancel={() => setActionType(null)}
          isSubmitting={createMut.isPending}
          submitDisabled={!createForm.contract_id || createForm.amount <= 0 || !createForm.received_date}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

export function DepositClaimForm({ controller }: { controller: Controller }) {
  const {
    actionType,
    setActionType,
    selectedDeposit,
    setSelectedDeposit,
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
    invoicesQuery,
    moveOutInspectionsQuery,
    formatDepositMoney,
    currencyCode,
    claimMut,
  } = controller;

  return (
    <EntityForm.Overlay
      open={actionType === 'claim'}
      onOpenChange={(open) => {
        if (!open && !claimMut.isPending) {
          setActionType(null);
          setSelectedDeposit(null);
        }
      }}
      title="طلب تخصيص من وديعة التأمين (بإثبات)"
      description={
        selectedDeposit
          ? `المتبقي: ${formatDepositMoney(selectedDeposit.remaining_amount)} — يحتاج الطلب اعتماد مستخدم مخوّل آخر قبل التطبيق`
          : undefined
      }
      visualVariant="operational"
    >
      <EntityForm.Root
        aria-busy={claimMut.isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount) return;
          if (!evidenceInput.trim()) return;
          if (claimKindInput === 'INVOICE_ARREARS' && !invoiceInput) return;
          if (claimKindInput === 'DAMAGE' && !inspectionInput) return;
          claimMut.mutate();
        }}
      >
        <EntityForm.ErrorSummary message={claimMut.isError ? depositErrorMessage(claimMut.error, 'تعذر إنشاء طلب التخصيص.') : undefined} />
        <EntityForm.Section title="بيانات الطلب">
          <EntityForm.Field label={`المبلغ (${currencyCode}) *`}>
            <Input
              required
              type="number"
              min="0.001"
              step="0.001"
              inputMode="decimal"
              dir="ltr"
              value={amountInput}
              onChange={(event) => setAmountInput(Number(event.target.value) || 0)}
              max={selectedDeposit?.remaining_amount}
            />
          </EntityForm.Field>
          <EntityForm.Field label="نوع الطلب *">
            <Select
              required
              value={claimKindInput}
              onChange={(event) => {
                const kind = event.target.value as DepositClaimCreatePayload['claim_kind'];
                setClaimKindInput(kind);
                if (kind === 'DAMAGE') setInvoiceInput('');
                else setInspectionInput('');
              }}
            >
              {Object.entries(depositClaimKindLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </EntityForm.Field>
          {claimKindInput === 'DAMAGE' ? (
            <EntityForm.Field
              label="فحص الإخلاء المراجع *"
              error={!inspectionInput ? 'لا يمكن طلب خصم أضرار دون فحص إخلاء مراجع.' : undefined}
            >
              <Select required value={inspectionInput} onChange={(event) => setInspectionInput(event.target.value)}>
                <option value="">اختر فحص الإخلاء</option>
                {moveOutInspectionsQuery.data?.map((inspection) => (
                  <option key={inspection.id} value={inspection.id}>
                    {inspection.inspected_on} — {inspection.summary || 'فحص إخلاء معتمد'}
                  </option>
                ))}
              </Select>
              {!moveOutInspectionsQuery.isLoading && (moveOutInspectionsQuery.data?.length ?? 0) === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">أكمل فحص الإخلاء واعتمده من ملف العقد أولاً.</p>
              ) : null}
            </EntityForm.Field>
          ) : null}
          {claimKindInput === 'INVOICE_ARREARS' ? (
            <EntityForm.Field label="الفاتورة المفتوحة *">
              <Select required value={invoiceInput} onChange={(event) => setInvoiceInput(event.target.value)}>
                <option value="">اختر الفاتورة</option>
                {invoicesQuery.data
                  ?.filter((invoice) => invoice.amount + (invoice.paid_amount ?? 0) > 0)
                  .map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.no || 'فاتورة بدون رقم'} — {formatDepositMoney(invoice.amount)} (متبقي{' '}
                      {formatDepositMoney(invoice.amount - (invoice.paid_amount ?? 0))})
                    </option>
                  ))}
              </Select>
            </EntityForm.Field>
          ) : null}
          <EntityForm.Field
            label="رابط / مرجع الإثبات *"
            error={!evidenceInput.trim() ? 'الإثبات مطلوب (رابط مستند أو مرجع).' : undefined}
          >
            <Input
              required
              value={evidenceInput}
              onChange={(event) => setEvidenceInput(event.target.value)}
              placeholder="ألصق رابط المستند أو اكتب مرجعًا واضحًا للإثبات"
              dir="ltr"
            />
          </EntityForm.Field>
          <EntityForm.Field label="ملاحظات">
            <Textarea
              value={claimNoteInput}
              onChange={(event) => setClaimNoteInput(event.target.value)}
              placeholder="تفاصيل التخصيص..."
            />
          </EntityForm.Field>
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel={claimMut.isPending ? 'جارٍ الإنشاء...' : 'إنشاء الطلب'}
          onCancel={() => {
            setActionType(null);
            setSelectedDeposit(null);
          }}
          isSubmitting={claimMut.isPending}
          submitDisabled={
            amountInput <= 0 ||
            !selectedDeposit ||
            amountInput > selectedDeposit.remaining_amount ||
            !evidenceInput.trim() ||
            (claimKindInput === 'INVOICE_ARREARS' && !invoiceInput) ||
            (claimKindInput === 'DAMAGE' && !inspectionInput)
          }
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

export function DepositRefundForm({ controller }: { controller: Controller }) {
  const {
    actionType,
    setActionType,
    selectedDeposit,
    setSelectedDeposit,
    amountInput,
    setAmountInput,
    paymentMethodInput,
    setPaymentMethodInput,
    claimNoteInput,
    setClaimNoteInput,
    formatDepositMoney,
    currencyCode,
    refundMut,
  } = controller;

  return (
    <EntityForm.Overlay
      open={actionType === 'refund'}
      onOpenChange={(open) => {
        if (!open && !refundMut.isPending) {
          setActionType(null);
          setSelectedDeposit(null);
        }
      }}
      title="رد وديعة التأمين"
      description={
        selectedDeposit ? `المتبقي: ${formatDepositMoney(selectedDeposit.remaining_amount)} — لن يسمح النظام بتجاوز الرصيد` : undefined
      }
      visualVariant="operational"
    >
      <EntityForm.Root
        aria-busy={refundMut.isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount) return;
          refundMut.mutate();
        }}
      >
        <EntityForm.ErrorSummary message={refundMut.isError ? depositErrorMessage(refundMut.error, 'تعذر رد وديعة التأمين.') : undefined} />
        <EntityForm.Section title="بيانات الاسترداد">
          <EntityForm.Field label={`المبلغ (${currencyCode}) *`}>
            <Input
              required
              type="number"
              min="0.001"
              step="0.001"
              inputMode="decimal"
              dir="ltr"
              value={amountInput}
              onChange={(event) => setAmountInput(Number(event.target.value) || 0)}
              max={selectedDeposit?.remaining_amount}
            />
          </EntityForm.Field>
          <EntityForm.Field label="طريقة الدفع *">
            <Select
              required
              value={paymentMethodInput}
              onChange={(event) => setPaymentMethodInput(event.target.value as DepositRefundPayload['payment_method'])}
            >
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="cash">نقداً</option>
              <option value="check">شيك</option>
            </Select>
          </EntityForm.Field>
          <EntityForm.Field label="ملاحظات">
            <Input
              value={claimNoteInput}
              onChange={(event) => setClaimNoteInput(event.target.value)}
              placeholder="ملاحظات الاسترداد..."
            />
          </EntityForm.Field>
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel={refundMut.isPending ? 'جارٍ التنفيذ...' : 'تأكيد الرد'}
          onCancel={() => {
            setActionType(null);
            setSelectedDeposit(null);
          }}
          isSubmitting={refundMut.isPending}
          submitDisabled={amountInput <= 0 || !selectedDeposit || amountInput > selectedDeposit.remaining_amount}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

export function DepositReasonForm({ controller }: { controller: Controller }) {
  const {
    actionType,
    setActionType,
    setSelectedClaim,
    setSelectedRefundEvent,
    reasonInput,
    setReasonInput,
    rejectMut,
    reverseClaimMut,
    reverseRefundMut,
  } = controller;

  const isOpen = actionType === 'rejectClaim' || actionType === 'reverseClaim' || actionType === 'reverseRefund';
  const title =
    actionType === 'rejectClaim'
      ? 'رفض طلب التخصيص'
      : actionType === 'reverseClaim'
        ? 'إلغاء التخصيص'
        : 'إلغاء الاسترداد';
  const mutationError = rejectMut.error || reverseClaimMut.error || reverseRefundMut.error;

  return (
    <EntityForm.Overlay
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !rejectMut.isPending && !reverseClaimMut.isPending && !reverseRefundMut.isPending) {
          setActionType(null);
          setSelectedClaim(null);
          setSelectedRefundEvent(null);
        }
      }}
      title={title}
      description="الإلغاء يحافظ على سجل الحركة ويعيد أثرها المالي تلقائيًا دون حذف العملية الأصلية."
      visualVariant="operational"
    >
      <EntityForm.Root
        aria-busy={rejectMut.isPending || reverseClaimMut.isPending || reverseRefundMut.isPending}
        onSubmit={(event) => {
          event.preventDefault();
          if (!reasonInput.trim()) return;
          if (actionType === 'rejectClaim') rejectMut.mutate();
          else if (actionType === 'reverseClaim') reverseClaimMut.mutate();
          else reverseRefundMut.mutate();
        }}
      >
        <EntityForm.ErrorSummary message={depositErrorMessage(mutationError, 'تعذر تنفيذ الإجراء المطلوب.')} />
        <EntityForm.Section title="السبب">
          <EntityForm.Field
            label="السبب *"
            error={!reasonInput.trim() ? 'السبب مطلوب (3 أحرف على الأقل).' : undefined}
          >
            <Textarea
              required
              value={reasonInput}
              onChange={(event) => setReasonInput(event.target.value)}
              placeholder="سبب الرفض / الإلغاء..."
            />
          </EntityForm.Field>
        </EntityForm.Section>
        <EntityForm.Actions
          submitLabel="تأكيد"
          onCancel={() => {
            setActionType(null);
            setSelectedClaim(null);
            setSelectedRefundEvent(null);
          }}
          isSubmitting={rejectMut.isPending || reverseClaimMut.isPending || reverseRefundMut.isPending}
          submitDisabled={!reasonInput.trim()}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}