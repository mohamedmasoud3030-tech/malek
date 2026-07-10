import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  paymentTermsIntervalLabels,
  paymentTermsIntervalValues,
  type PaymentTermsFormValues,
  type PaymentTermsRecord,
} from './paymentTermsService';
import { useArchivePaymentTerms, usePaymentTerms, useSavePaymentTerms } from './usePaymentTerms';

const defaultFormValues: PaymentTermsFormValues = {
  name: '',
  installments: 1,
  interval_type: 'monthly',
  notes: '',
  is_active: true,
};

function toFormValues(record: PaymentTermsRecord): PaymentTermsFormValues {
  const interval = paymentTermsIntervalValues.includes(record.interval_type as (typeof paymentTermsIntervalValues)[number])
    ? record.interval_type as (typeof paymentTermsIntervalValues)[number]
    : 'monthly';

  return {
    name: record.name,
    installments: record.installments ?? 1,
    interval_type: interval,
    notes: record.notes ?? '',
    is_active: record.is_active ?? true,
  };
}

function shouldSaveOnEnter(event: KeyboardEvent<HTMLElement>) {
  return event.key === 'Enter' && !event.shiftKey && !(event.target instanceof HTMLTextAreaElement);
}

export function PaymentTermsSettingsSection() {
  const paymentTermsQuery = usePaymentTerms();
  const savePaymentTerms = useSavePaymentTerms();
  const archivePaymentTerms = useArchivePaymentTerms();
  const [editingId, setEditingId] = useState<string | undefined>();
  const [draft, setDraft] = useState<PaymentTermsFormValues>(defaultFormValues);

  const resetDraft = () => {
    setEditingId(undefined);
    setDraft(defaultFormValues);
  };

  const saveDraft = () => {
    if (savePaymentTerms.isPending) return;
    savePaymentTerms.mutate({ id: editingId, values: draft }, { onSuccess: resetDraft });
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!shouldSaveOnEnter(event)) return;
    event.preventDefault();
    saveDraft();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border bg-muted/20 p-3 md:grid-cols-2" onKeyDown={handleEditorKeyDown}>
        <label className="space-y-1 text-sm font-medium">
          <span>اسم شرط السداد</span>
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="مثال: ربع سنوي" />
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>عدد الدفعات</span>
          <Input
            type="number"
            min="1"
            step="1"
            value={draft.installments}
            onChange={(event) => setDraft({ ...draft, installments: Number(event.target.value) })}
          />
        </label>
        <label className="space-y-1 text-sm font-medium">
          <span>الفاصل الزمني</span>
          <Select value={draft.interval_type} onChange={(event) => setDraft({ ...draft, interval_type: event.target.value as PaymentTermsFormValues['interval_type'] })}>
            {paymentTermsIntervalValues.map((interval) => (
              <option key={interval} value={interval}>{paymentTermsIntervalLabels[interval]}</option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 rounded-xl border bg-background/70 p-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={draft.is_active}
            onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
          />
          <span>نشط للاستخدام في العقود</span>
        </label>
        <label className="space-y-1 text-sm font-medium md:col-span-2">
          <span>ملاحظات</span>
          <Textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="ملاحظات داخلية اختيارية" />
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="button" onClick={saveDraft} disabled={savePaymentTerms.isPending}>
            {editingId ? 'تحديث شرط السداد' : 'إضافة شرط سداد'}
          </Button>
          {editingId ? <Button type="button" variant="secondary" onClick={resetDraft}>إلغاء التعديل</Button> : null}
        </div>
      </div>

      <div className="space-y-2">
        {(paymentTermsQuery.data ?? []).map((term) => (
          <div key={term.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-background/70 p-3 text-sm">
            <div>
              <p className="font-black">{term.name}</p>
              <p className="text-muted-foreground">
                {(term.installments ?? 1).toLocaleString('ar')} دفعات · {paymentTermsIntervalLabels[(term.interval_type as PaymentTermsFormValues['interval_type'])] ?? term.interval_type ?? 'غير محدد'}
                {term.is_active === false ? ' · غير نشط' : ''}
              </p>
              {term.notes ? <p className="mt-1 text-xs text-muted-foreground">{term.notes}</p> : null}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => { setEditingId(term.id); setDraft(toFormValues(term)); }}>تعديل</Button>
              <Button type="button" variant="secondary" onClick={() => archivePaymentTerms.mutate(term.id)} disabled={archivePaymentTerms.isPending}>أرشفة</Button>
            </div>
          </div>
        ))}
        {paymentTermsQuery.isLoading ? <p className="text-sm text-muted-foreground">جار تحميل شروط السداد...</p> : null}
        {!paymentTermsQuery.isLoading && (paymentTermsQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">لا توجد شروط سداد محفوظة بعد.</p>
        ) : null}
      </div>
    </div>
  );
}
