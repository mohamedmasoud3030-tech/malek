import { useMemo, useState } from 'react';
import { FileUp, AlertTriangle, CheckCircle2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntityForm } from '@/components/ui/entity-form';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { useBankAccounts } from './useBankReconciliation';
import { previewBankCsvFile, importBankStatementBatch, toImportPayloadRows, type BankImportPreview, type BankImportResult } from './bankCsvImportService';
import type { BankCsvParseResult } from '@/lib/bankCsvParser';
import { toast } from 'sonner';

type Step = 'select' | 'preview' | 'mapping' | 'review' | 'importing' | 'completed';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBankAccountId?: string;
  onCompleted: (result: BankImportResult) => void;
  canManage: boolean;
}

export function BankCsvImportWorkflow({ open, onOpenChange, defaultBankAccountId, onCompleted, canManage }: Props) {
  const [step, setStep] = useState<Step>('select');
  const [file, setFile] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState(defaultBankAccountId ?? '');
  const [preview, setPreview] = useState<BankImportPreview | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importResult, setImportResult] = useState<BankImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const accountsQuery = useBankAccounts();
  const accounts = accountsQuery.data ?? [];

  const reset = () => {
    setFile(null);
    setPreview(null);
    setImportResult(null);
    setError(null);
    setStep('select');
    setIsParsing(false);
    setIsImporting(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && (isParsing || isImporting)) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFileChange = async (selectedFile: File | null) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);
    setIsParsing(true);
    try {
      // Basic validation
      if (selectedFile.size > 5 * 1024 * 1024) {
        throw new Error('حجم الملف يتجاوز 5MB');
      }
      const lowerName = selectedFile.name.toLowerCase();
      if (!lowerName.endsWith('.csv') && selectedFile.type !== 'text/csv' && !lowerName.endsWith('.txt')) {
        // Allow .csv only but be lenient for .txt that contains csv
        if (!lowerName.endsWith('.csv')) {
          throw new Error('الملف يجب أن يكون بصيغة CSV');
        }
      }

      const parsed = await previewBankCsvFile(selectedFile);
      setPreview(parsed);

      if (parsed.missingMandatory.length > 0) {
        setStep('mapping');
      } else if (parsed.rejectedRows.length > 0 && parsed.validRows.length === 0) {
        setStep('review');
      } else {
        setStep('preview');
      }
    } catch (e: any) {
      setError(e?.message ?? 'تعذر قراءة الملف');
      setStep('select');
    } finally {
      setIsParsing(false);
    }
  };

  const canProceedToReview = useMemo(() => {
    if (!preview) return false;
    return preview.missingMandatory.length === 0 && preview.validRows.length > 0;
  }, [preview]);

  const handleConfirmImport = async () => {
    if (!preview || !bankAccountId || !file) return;
    if (!canManage) {
      toast.error('ليس لديك صلاحية استيراد كشف البنك');
      return;
    }
    if (preview.missingMandatory.length > 0) {
      toast.error(`أعمدة إلزامية مفقودة: ${preview.missingMandatory.join(', ')}`);
      return;
    }
    if (preview.validRows.length === 0) {
      toast.error('لا توجد صفوف صالحة للاستيراد');
      return;
    }

    setIsImporting(true);
    setStep('importing');
    setError(null);
    try {
      const payloadRows = toImportPayloadRows(preview);
      const result = await importBankStatementBatch({
        bank_account_id: bankAccountId,
        file_name: file.name,
        file_fingerprint: preview.fileFingerprint,
        file_size: file.size,
        rows: payloadRows,
      });
      setImportResult(result);
      setStep('completed');
      if (result.is_duplicate_file) {
        toast.success(`الملف مستورد مسبقاً — المرجع ${result.reference ?? result.id.slice(0, 8)}`);
      } else {
        toast.success(`تم الاستيراد بنجاح — ${result.accepted_rows} حركة جديدة`);
      }
      onCompleted(result);
    } catch (e: any) {
      const msg = e?.message ?? 'تعذر استيراد الملف';
      setError(msg);
      setStep('review');
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const renderSelectStep = () => (
    <EntityForm.Section title="1. اختر ملف CSV" description="يدعم UTF-8 وBOM، فواصل فاصلة أو فاصلة منقوطة، رؤوس عربية وإنجليزية.">
      <div className="grid gap-4">
        <EntityForm.Field label="الحساب البنكي">
          <Select required value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
            <option value="">اختر الحساب البنكي</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.account_name} — {acc.currency}
              </option>
            ))}
          </Select>
        </EntityForm.Field>

        <EntityForm.Field label="ملف كشف البنك">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept=".csv,text/csv,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  handleFileChange(f);
                }}
                disabled={isParsing}
              />
            </div>
            {file ? (
              <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                <p className="font-bold">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  الحجم: {(file.size / 1024).toFixed(1)} KB — {preview?.encoding ?? '—'} — فاصل: {preview?.delimiter === ';' ? 'فاصلة منقوطة ;' : 'فاصلة ,'} {preview?.detectedDelimiterConfidence ? `(${preview.detectedDelimiterConfidence})` : ''}
                </p>
              </div>
            ) : null}
            {isParsing ? <p className="text-sm text-muted-foreground">جارٍ تحليل الملف...</p> : null}
            {error ? (
              <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : null}
          </div>
        </EntityForm.Field>
      </div>
    </EntityForm.Section>
  );

  const renderPreviewStep = () => {
    if (!preview) return null;
    return (
      <>
        <EntityForm.Section title="2. معاينة قبل الحفظ" description="لن يتم حفظ أي بيانات قبل تأكيدك.">
          <div className="grid gap-3 rounded-xl border bg-card p-3 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div>
                <span className="text-xs text-muted-foreground">اسم الملف</span>
                <p className="font-bold truncate">{preview.fileName}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">الترميز</span>
                <p className="font-bold">{preview.encoding}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">الفاصل</span>
                <p className="font-bold">{preview.delimiter === ';' ? 'فاصلة منقوطة ;' : 'فاصلة ,'} ({preview.detectedDelimiterConfidence})</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">إجمالي الصفوف</span>
                <p className="font-black">{preview.totalRows}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">صالحة</span>
                <p className="font-black text-success">{preview.validRows.length}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">مرفوضة</span>
                <p className="font-black text-destructive">{preview.rejectedRows.length}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">مكرر داخل الملف</span>
                <p className="font-black text-warning">{preview.duplicateWithinFile}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">بصمة الملف</span>
                <p className="font-mono text-[10px] truncate" title={preview.fileFingerprint}>{preview.fileFingerprint.slice(0, 16)}...</p>
              </div>
            </div>

            {preview.headers.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-muted-foreground">الرؤوس المكتشفة:</p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {preview.headers.map((h, i) => (
                    <span key={i} className="rounded bg-muted px-2 py-0.5 text-xs">
                      {h}
                    </span>
                  ))}
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-xs font-bold text-muted-foreground">تعيين الأعمدة:</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {preview.columnMapping.map((m) => (
                  <span key={m.field} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
                    <strong>{m.field}</strong>
                    <span className="text-muted-foreground">←</span>
                    <span>{m.header}</span>
                  </span>
                ))}
                {preview.columnMapping.length === 0 ? <span className="text-xs text-destructive">لم يتم التعرف على الأعمدة</span> : null}
              </div>
              {preview.mappingAmbiguous ? (
                <p className="mt-2 text-xs text-destructive">تعيين غامض: نفس الحقل مرتبط بأكثر من عمود — يحتاج مراجعة.</p>
              ) : null}
            </div>
          </div>
        </EntityForm.Section>

        <EntityForm.Section title="معاينة الصفوف المطبيعة (أول 10)" description="تأكد من التاريخ والمبلغ والوصف قبل الاستيراد.">
          <div className="overflow-x-auto rounded-xl border">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-right">التاريخ</th>
                  <th className="p-2 text-right">المبلغ</th>
                  <th className="p-2 text-right">الوصف</th>
                  <th className="p-2 text-right">المرجع</th>
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{row.transaction_date}</td>
                    <td className="p-2 font-mono tabular-nums" dir="ltr">
                      {row.amount?.toFixed(3)}
                    </td>
                    <td className="p-2 truncate max-w-[12rem]">{row.description}</td>
                    <td className="p-2">{row.reference ?? '—'}</td>
                  </tr>
                ))}
                {preview.previewRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground">
                      لا توجد صفوف صالحة للمعاينة
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </EntityForm.Section>

        {preview.rejectedRows.length > 0 ? (
          <EntityForm.Section title={`الصفوف المرفوضة (${preview.rejectedRows.length})`} description="تحتاج تصحيح قبل الاستيراد. النظام يرفض الدفعة كاملة إذا وجدت صفوف غير صالحة (fail-closed).">
            <div className="max-h-64 overflow-auto rounded-xl border">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-right">رقم السطر</th>
                    <th className="p-2 text-right">السبب</th>
                    <th className="p-2 text-right">البيانات الخام</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rejectedRows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.rowNumber}</td>
                      <td className="p-2 text-destructive">{r.reason}</td>
                      <td className="p-2 truncate max-w-[16rem] font-mono text-[11px]">{r.raw.join(' | ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rejectedRows.length > 50 ? <p className="mt-2 text-xs text-muted-foreground">يعرض أول 50 فقط من {preview.rejectedRows.length}</p> : null}
          </EntityForm.Section>
        ) : null}
      </>
    );
  };

  const renderMappingStep = () => {
    if (!preview) return null;
    return (
      <EntityForm.Section title="تعيين الأعمدة" description="الرؤوس غير واضحة أو أعمدة إلزامية مفقودة. راجع الملف أو صحح الأعمدة.">
        <div className="space-y-3">
          <div className="rounded-xl border border-warning/30 bg-warning-bg/40 p-3 text-sm">
            <p className="flex items-center gap-2 font-bold text-warning">
              <AlertTriangle className="size-4" /> هناك مشكلة في تعيين الأعمدة
            </p>
            <ul className="mt-2 list-disc ps-5 text-xs">
              {preview.missingMandatory.length > 0 ? <li>أعمدة إلزامية مفقودة: {preview.missingMandatory.join(', ')}</li> : null}
              {preview.mappingAmbiguous ? <li>تعيين غامض: نفس الحقل مرتبط بأكثر من عمود</li> : null}
              {preview.errorSummary ? <li>{preview.errorSummary}</li> : null}
            </ul>
          </div>

          <div className="grid gap-2 text-xs">
            <p>الرؤوس المكتشفة: {preview.headers.join(' | ') || 'لا يوجد'}</p>
            <p>الفاصل المكتشف: {preview.delimiter} ({preview.detectedDelimiterConfidence})</p>
            <p>التعيين الحالي:</p>
            <div className="flex flex-wrap gap-1">
              {preview.columnMapping.map((m) => (
                <span key={m.field} className="rounded bg-muted px-2 py-1">
                  {m.field} ← {m.header} (عمود {m.index})
                </span>
              ))}
              {preview.columnMapping.length === 0 ? <span className="text-destructive">لا يوجد تعيين</span> : null}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            يدعم النظام الرؤوس العربية: التاريخ، المبلغ، الوصف، المرجع، الرصيد، العملة، مدين، دائن. تأكد من وجود تاريخ ومبلغ أو عمودي مدين/دائن.
            لا يتم التخمين الصامت للتعيين الغامض.
          </p>
        </div>
      </EntityForm.Section>
    );
  };

  const renderCompletedStep = () => {
    if (!importResult) return null;
    return (
      <EntityForm.Section title="اكتمل الاستيراد" description="ملخص الدفعة المستوردة.">
        <div className="grid gap-3 rounded-xl border bg-success/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-black text-success">
            <CheckCircle2 className="size-5" /> {importResult.is_duplicate_file ? 'الملف مكرر — تم إرجاع الدفعة السابقة' : 'تم الاستيراد بنجاح'}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <span className="text-xs text-muted-foreground">المرجع</span>
              <p className="font-mono font-bold">{importResult.reference ?? importResult.id.slice(0, 8)}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">الملف</span>
              <p className="font-bold truncate">{importResult.file_name}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">الحالة</span>
              <p><StatusBadge tone={importResult.status === 'completed' ? 'success' : importResult.status === 'duplicate' ? 'warning' : 'neutral'}>{importResult.status}</StatusBadge></p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">إجمالي</span>
              <p className="font-black">{importResult.total_rows}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">مقبول</span>
              <p className="font-black text-success">{importResult.accepted_rows}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">مكرر</span>
              <p className="font-black text-warning">{importResult.duplicate_rows}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">مكرر محتمل</span>
              <p className="font-black">{importResult.possible_duplicate_rows}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">تم حفظ الدفعة بمرجع تجاري {importResult.reference ?? ''} مع عزل شركة كامل وبصمة ملف {importResult.file_fingerprint?.slice(0, 12)}... بدون إنشاء قيود محاسبية تلقائية. حالة المطابقة: مستوردة، تحتاج مراجعة يدوية.</p>
        </div>
      </EntityForm.Section>
    );
  };

  return (
    <EntityForm.Overlay open={open} onOpenChange={handleOpenChange} title="استيراد كشف البنك — عملية مرحلية" description="اختر الملف، اعرض المعاينة، راجع المرفوض، أكد الاستيراد. لن يتم الحفظ قبل التأكيد.">
      <EntityForm.Root
        aria-busy={isParsing || isImporting}
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 'select' || step === 'preview' || step === 'mapping') {
            if (canProceedToReview) setStep('review');
          }
        }}
      >
        {step === 'select' ? renderSelectStep() : null}
        {step === 'preview' ? renderPreviewStep() : null}
        {step === 'mapping' ? (
          <>
            {renderSelectStep()}
            {renderMappingStep()}
            {renderPreviewStep()}
          </>
        ) : null}
        {step === 'review' ? (
          <>
            {renderSelectStep()}
            {renderPreviewStep()}
          </>
        ) : null}
        {step === 'importing' ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm font-bold">جارٍ الاستيراد وحفظ الدفعة بشكل ذري...</p>
          </div>
        ) : null}
        {step === 'completed' ? renderCompletedStep() : null}

        <EntityForm.Actions
          submitLabel={
            step === 'select'
              ? 'تحليل الملف'
              : step === 'preview'
                ? 'مراجعة التفاصيل'
                : step === 'review'
                  ? isImporting
                    ? 'جارٍ الاستيراد...'
                    : 'تأكيد الاستيراد'
                  : step === 'mapping'
                    ? 'إعادة تحليل'
                    : step === 'completed'
                      ? 'الانتقال للمطابقة'
                      : 'متابعة'
          }
          onCancel={() => handleOpenChange(false)}
          isSubmitting={isParsing || isImporting}
          submitDisabled={
            !bankAccountId ||
            (step === 'select' && !preview) ||
            (step === 'preview' && !canProceedToReview) ||
            (step === 'review' && (!canProceedToReview || isImporting || !canManage)) ||
            (step === 'mapping' && true) ||
            (step === 'importing' ? true : false)
          }
        />

        {/* Extra actions row for import */}
        {(step === 'review' || step === 'preview') && canProceedToReview ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setStep('select')} disabled={isParsing || isImporting}>
              اختيار ملف آخر
            </Button>
            <Button type="button" disabled={!bankAccountId || isImporting || !canManage} onClick={handleConfirmImport} className="min-h-11">
              <Upload className="me-2 size-4" />
              {isImporting ? 'جارٍ الاستيراد...' : `استيراد ${preview?.validRows.length ?? 0} حركة صالحة`}
            </Button>
          </div>
        ) : null}

        {step === 'completed' ? (
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
              إغلاق
            </Button>
            <Button type="button" onClick={() => handleOpenChange(false)}>
              الذهاب للمطابقة
            </Button>
          </div>
        ) : null}
      </EntityForm.Root>
    </EntityForm.Overlay>
  );
}
