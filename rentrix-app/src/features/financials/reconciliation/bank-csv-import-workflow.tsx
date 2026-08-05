import { useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, FileUp } from 'lucide-react';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { toast } from 'sonner';
import { useBankAccounts } from './useBankReconciliation';
import {
  assertImportPreviewReady,
  importBankStatementBatch,
  previewBankCsvFile,
  toImportPayloadRows,
  type BankImportPreview,
  type BankImportResult,
} from './bankCsvImportService';

type Step = 'select' | 'preview' | 'importing' | 'completed';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBankAccountId?: string;
  onCompleted: (result: BankImportResult) => void;
  canManage: boolean;
}

export function BankCsvImportWorkflow({
  open,
  onOpenChange,
  defaultBankAccountId,
  onCompleted,
  canManage,
}: Props) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState(defaultBankAccountId ?? '');
  const [preview, setPreview] = useState<BankImportPreview | null>(null);
  const [result, setResult] = useState<BankImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const accountsQuery = useBankAccounts();
  const accounts = accountsQuery.data ?? [];

  const readinessError = useMemo(() => {
    if (!preview) return null;
    try {
      assertImportPreviewReady(preview);
      return null;
    } catch (caught) {
      return caught instanceof Error ? caught.message : 'الملف غير جاهز للاستيراد.';
    }
  }, [preview]);

  const reset = () => {
    setStep('select');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsParsing(false);
    setIsImporting(false);
  };

  const close = () => {
    if (isParsing || isImporting) return;
    reset();
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) close();
    else onOpenChange(true);
  };

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsParsing(true);

    try {
      const lowerName = selectedFile.name.toLowerCase();
      if (!lowerName.endsWith('.csv')) {
        throw new Error('الملف يجب أن يكون بصيغة CSV.');
      }
      const parsed = await previewBankCsvFile(selectedFile);
      setPreview(parsed);
      setStep('preview');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'تعذر قراءة ملف كشف البنك.';
      setError(message);
      setStep('select');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!preview || !file || !bankAccountId) {
      setError('اختر الحساب البنكي وملف CSV أولاً.');
      return;
    }
    if (!canManage) {
      setError('ليس لديك صلاحية استيراد كشف البنك.');
      return;
    }

    try {
      assertImportPreviewReady(preview);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'الملف غير جاهز للاستيراد.');
      return;
    }

    setError(null);
    setIsImporting(true);
    setStep('importing');

    try {
      const rows = toImportPayloadRows(preview);
      const imported = await importBankStatementBatch({
        bank_account_id: bankAccountId,
        file_name: file.name,
        file_fingerprint: preview.fileFingerprint,
        file_size: file.size,
        source_total_rows: preview.totalRows,
        rejected_rows: preview.rejectedRows.length,
        rows,
      });

      setResult(imported);
      setStep('completed');
      onCompleted(imported);
      toast.success(
        imported.is_duplicate_file
          ? `الملف مستورد مسبقًا — ${imported.reference ?? imported.id.slice(0, 8)}`
          : `تم حفظ ${imported.accepted_rows} حركة جديدة — ${imported.reference ?? imported.id.slice(0, 8)}`,
      );
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'تعذر استيراد كشف البنك.';
      setError(message);
      setStep('preview');
      toast.error(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 'select') {
      if (preview) setStep('preview');
      return;
    }
    if (step === 'preview') {
      void handleImport();
      return;
    }
    if (step === 'completed') close();
  };

  const submitLabel = step === 'select'
    ? isParsing ? 'جارٍ تحليل الملف...' : 'معاينة الملف'
    : step === 'preview'
      ? isImporting ? 'جارٍ الاستيراد...' : 'تأكيد الاستيراد الكامل'
      : step === 'completed'
        ? 'إغلاق والعودة للمطابقة'
        : 'جارٍ الاستيراد...';

  const submitDisabled = step === 'importing'
    || isParsing
    || isImporting
    || !bankAccountId
    || (step === 'select' && !preview)
    || (step === 'preview' && Boolean(readinessError))
    || (step === 'preview' && !canManage);

  return (
    <EntityForm.Overlay
      open={open}
      onOpenChange={handleOpenChange}
      title="استيراد كشف البنك"
      description="الاستيراد كامل أو مرفوض بالكامل: صحح كل صف قبل الحفظ."
    >
      <EntityForm.Root aria-busy={isParsing || isImporting} onSubmit={handleSubmit}>
        <EntityForm.ErrorSummary message={error ?? readinessError} />

        {step !== 'completed' ? (
          <EntityForm.Section
            title="ملف الكشف والحساب البنكي"
            description="CSV برؤوس عربية أو إنجليزية واضحة، حتى 5MB و10000 صف."
          >
            <div className="grid gap-4">
              <EntityForm.Field label="الحساب البنكي">
                <Select
                  required
                  value={bankAccountId}
                  onChange={(event) => setBankAccountId(event.target.value)}
                  disabled={isParsing || isImporting}
                >
                  <option value="">اختر الحساب البنكي</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_name} — {account.currency}
                    </option>
                  ))}
                </Select>
              </EntityForm.Field>

              <EntityForm.Field label="ملف CSV">
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  disabled={isParsing || isImporting}
                  onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
                />
              </EntityForm.Field>

              {file ? (
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <p className="flex items-center gap-2 font-bold">
                    <FileUp className="size-4" /> {file.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                    {preview ? ` — ${preview.encoding} — فاصل ${preview.delimiter}` : ''}
                  </p>
                </div>
              ) : null}
            </div>
          </EntityForm.Section>
        ) : null}

        {step === 'preview' && preview ? <PreviewStep preview={preview} /> : null}

        {step === 'importing' ? (
          <div className="flex flex-col items-center gap-3 py-10" role="status">
            <span className="size-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="font-bold">جارٍ التحقق والحفظ الذري...</p>
            <p className="text-sm text-muted-foreground">أي خطأ يلغي الدفعة بالكامل.</p>
          </div>
        ) : null}

        {step === 'completed' && result ? <CompletedStep result={result} /> : null}

        <EntityForm.Actions
          submitLabel={submitLabel}
          onCancel={close}
          isSubmitting={isParsing || isImporting}
          submitDisabled={submitDisabled}
        />
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}

function PreviewStep({ preview }: { preview: BankImportPreview }) {
  return (
    <>
      <EntityForm.Section title="المعاينة" description="لن يُحفظ أي صف إن وُجد صف واحد مرفوض.">
        <div className="grid gap-3 rounded-xl border p-3 text-sm sm:grid-cols-3">
          <Metric label="إجمالي المصدر" value={preview.totalRows} />
          <Metric label="صالح" value={preview.validRows.length} tone="success" />
          <Metric label="مرفوض" value={preview.rejectedRows.length} tone="danger" />
          <Metric label="مكرر داخل الملف" value={preview.duplicateWithinFile} tone="warning" />
          <Metric label="الرؤوس" value={preview.hasHeader ? preview.headers.length : 0} />
          <div>
            <p className="text-xs text-muted-foreground">بصمة SHA-256</p>
            <p className="truncate font-mono text-xs" title={preview.fileFingerprint}>
              {preview.fileFingerprint.slice(0, 18)}…
            </p>
          </div>
        </div>
      </EntityForm.Section>

      <EntityForm.Section title="أول 10 حركات مطبّعة">
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right">التاريخ</th>
                <th className="p-2 text-right">المبلغ</th>
                <th className="p-2 text-right">الوصف</th>
                <th className="p-2 text-right">العملة</th>
              </tr>
            </thead>
            <tbody>
              {preview.previewRows.map((row) => (
                <tr key={`${row.rawIndex}-${row.fingerprint}`} className="border-t">
                  <td className="p-2">{row.transaction_date}</td>
                  <td className="p-2 font-mono" dir="ltr">{row.amount?.toFixed(3)}</td>
                  <td className="max-w-48 truncate p-2">{row.description}</td>
                  <td className="p-2">{row.currency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EntityForm.Section>

      {preview.rejectedRows.length > 0 ? (
        <EntityForm.Section
          title={`صفوف مرفوضة (${preview.rejectedRows.length})`}
          description="صحح الملف وأعد اختياره؛ زر الاستيراد معطل."
        >
          <div className="max-h-64 overflow-auto rounded-xl border border-destructive/30">
            {preview.rejectedRows.slice(0, 50).map((row) => (
              <div key={`${row.rowNumber}-${row.reason}`} className="border-b p-3 text-sm last:border-b-0">
                <p className="flex items-center gap-2 font-bold text-destructive">
                  <AlertTriangle className="size-4" /> السطر {row.rowNumber}: {row.reason}
                </p>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{row.raw.join(' | ')}</p>
              </div>
            ))}
          </div>
        </EntityForm.Section>
      ) : null}
    </>
  );
}

function CompletedStep({ result }: { result: BankImportResult }) {
  return (
    <EntityForm.Section title="اكتمل الاستيراد" description="الصفوف المحفوظة تطابق ملخص الدفعة.">
      <div className="grid gap-4 rounded-xl border bg-success/5 p-4">
        <p className="flex items-center gap-2 font-black text-success">
          <CheckCircle2 className="size-5" />
          {result.is_duplicate_file ? 'تم إرجاع الدفعة الموجودة دون تكرار' : 'تم الحفظ بنجاح'}
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Metric label="المرجع" value={result.reference ?? result.id.slice(0, 8)} />
          <Metric label="إجمالي" value={result.total_rows} />
          <Metric label="محفوظ" value={result.accepted_rows} tone="success" />
          <Metric label="مكرر" value={result.duplicate_rows} tone="warning" />
        </div>
        <StatusBadge tone={result.status === 'completed' ? 'success' : 'warning'}>{result.status}</StatusBadge>
        <p className="text-xs text-muted-foreground">
          لا توجد قيود محاسبية تلقائية. الحركات محفوظة بحالة “غير مطابقة” للمراجعة اليدوية.
        </p>
      </div>
    </EntityForm.Section>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: 'neutral' | 'success' | 'danger' | 'warning';
}) {
  const toneClass = tone === 'success'
    ? 'text-success'
    : tone === 'danger'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-warning'
        : '';

  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-black ${toneClass}`}>{value}</p>
    </div>
  );
}
