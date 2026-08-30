import { Plus, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
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
import { formatLatinNumber } from '@/lib/formatters';

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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const terms = paymentTermsQuery.data ?? [];

  const closeEditor = () => {
    setEditingId(undefined);
    setDraft(defaultFormValues);
    setIsEditorOpen(false);
  };

  const openNewEditor = () => {
    setEditingId(undefined);
    setDraft(defaultFormValues);
    setIsEditorOpen(true);
  };

  const openEditEditor = (term: PaymentTermsRecord) => {
    setEditingId(term.id);
    setDraft(toFormValues(term));
    setIsEditorOpen(true);
  };

  const saveDraft = () => {
    if (savePaymentTerms.isPending) return;
    savePaymentTerms.mutate({ id: editingId, values: draft }, { onSuccess: closeEditor });
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!shouldSaveOnEnter(event)) return;
    event.preventDefault();
    saveDraft();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-black">القوالب المحفوظة</p>
          <p className="text-[11px] font-bold text-muted-foreground">{formatLatinNumber(terms.length, 'ar')} قالب</p>
        </div>
        <Button type="button" size="sm" onClick={openNewEditor} disabled={isEditorOpen && !editingId}>
          <Plus className="size-4 sm:me-1.5" aria-hidden="true" />
          إضافة شرط
        </Button>
      </div>

      {isEditorOpen ? (
        <div className="grid gap-2.5 rounded-xl border border-primary/20 bg-primary/[0.025] p-2.5 sm:grid-cols-2 sm:gap-3 sm:p-3" onKeyDown={handleEditorKeyDown}>
          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            <p className="text-xs font-black">{editingId ? 'تعديل شرط السداد' : 'شرط سداد جديد'}</p>
            <Button type="button" variant="ghost" size="icon" onClick={closeEditor} aria-label="إغلاق المحرر">
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <EntityForm.Field label="اسم شرط السداد">
            <Input className="min-h-11 rounded-lg text-sm" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="مثال: ربع سنوي" />
          </EntityForm.Field>
          <EntityForm.Field label="عدد الدفعات">
            <Input
              className="min-h-11 rounded-lg text-sm"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={draft.installments}
              onChange={(event) => setDraft({ ...draft, installments: Number(event.target.value) })}
            />
          </EntityForm.Field>
          <EntityForm.Field label="الفاصل الزمني">
            <Select className="min-h-11 rounded-lg text-sm" value={draft.interval_type} onChange={(event) => setDraft({ ...draft, interval_type: event.target.value as PaymentTermsFormValues['interval_type'] })}>
              {paymentTermsIntervalValues.map((interval) => (
                <option key={interval} value={interval}>{paymentTermsIntervalLabels[interval]}</option>
              ))}
            </Select>
          </EntityForm.Field>
          <label className="flex min-h-11 items-center gap-2 rounded-lg border bg-background/70 px-3 py-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(event) => setDraft({ ...draft, is_active: event.target.checked })}
            />
            <span>نشط للاستخدام في العقود</span>
          </label>
          <EntityForm.Field label="ملاحظات" className="sm:col-span-2">
            <Textarea className="min-h-20 rounded-lg text-sm" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} placeholder="ملاحظات داخلية اختيارية" />
          </EntityForm.Field>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="button" size="sm" onClick={saveDraft} disabled={savePaymentTerms.isPending}>
              {editingId ? 'حفظ التعديل' : 'إضافة القالب'}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={closeEditor}>إلغاء</Button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {terms.map((term) => (
          <div key={term.id} className="flex items-center justify-between gap-2 rounded-xl border bg-background/70 p-2.5 text-xs sm:p-3 sm:text-sm">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-black">{term.name}</p>
                {term.is_active === false ? <span className="shrink-0 text-[10px] font-black text-muted-foreground">غير نشط</span> : null}
              </div>
              <p className="mt-0.5 truncate text-[11px] font-bold text-muted-foreground sm:text-xs">
                {formatLatinNumber((term.installments ?? 1), 'ar')} دفعات · {paymentTermsIntervalLabels[(term.interval_type as PaymentTermsFormValues['interval_type'])] ?? term.interval_type ?? 'غير محدد'}
              </p>
              {term.notes ? <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{term.notes}</p> : null}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button type="button" size="sm" variant="secondary" className="px-2.5" onClick={() => openEditEditor(term)}>تعديل</Button>
              <Button type="button" size="sm" variant="ghost" className="px-2.5 text-muted-foreground" onClick={() => archivePaymentTerms.mutate(term.id)} disabled={archivePaymentTerms.isPending}>أرشفة</Button>
            </div>
          </div>
        ))}
        {paymentTermsQuery.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل شروط السداد...</p> : null}
        {paymentTermsQuery.isError ? (
          <p className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm font-medium text-danger" role="alert">
            تعذر تحميل شروط السداد. أعد المحاولة بعد لحظات.
          </p>
        ) : null}
        {!paymentTermsQuery.isLoading && !paymentTermsQuery.isError && terms.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-6 text-center">
            <p className="text-sm font-black">لا توجد شروط سداد بعد</p>
            <p className="mt-1 text-xs text-muted-foreground">أضف أول قالب لاستخدامه عند إنشاء العقود.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
