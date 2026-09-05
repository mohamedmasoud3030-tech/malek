import { useMemo, useState, type ChangeEvent } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadBlob } from '@/lib/tabular-export';
import type { CompanySettingsDraft } from '@/features/settings/settingsForm';
import { deriveOfficeReadiness } from './office-readiness';
import {
  officeImportSpecs,
  parseOfficeImportFile,
  type OfficeImportEntity,
  type OfficeImportPreview,
} from './import/office-import';
import {
  buildCanonicalOfficeImportPreview,
  buildCanonicalOfficeImportTemplate,
} from './import/office-import-contract';

const entityOptions: readonly Readonly<{ id: OfficeImportEntity; label: string }>[] = [
  { id: 'owners', label: 'الملاك' },
  { id: 'properties', label: 'العقارات' },
  { id: 'units', label: 'الوحدات' },
  { id: 'tenants', label: 'المستأجرون' },
  { id: 'contracts', label: 'العقود' },
];

function TemplateButton({ entity, format }: Readonly<{ entity: OfficeImportEntity; format: 'csv' | 'xlsx' }>) {
  const download = () => {
    const template = buildCanonicalOfficeImportTemplate(entity, format);
    downloadBlob(template.blob, template.filename);
  };
  return (
    <Button type="button" size="sm" variant="outline" onClick={download}>
      <Download className="size-4" aria-hidden="true" />
      قالب {format.toUpperCase()}
    </Button>
  );
}

function PreviewTable({ preview }: Readonly<{ preview: OfficeImportPreview }>) {
  const spec = officeImportSpecs[preview.entity];
  const visibleFields = spec.fields.slice(0, 5);
  const rows = preview.rows.slice(0, 5);
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60">
      <Table className="min-w-[620px]" density="compact">
        <TableHeader>
          <TableRow>
            {visibleFields.map((field) => <TableHead key={field.key}>{field.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`preview-${index}`}>
              {visibleFields.map((field) => <TableCell key={field.key} className="max-w-48 truncate">{row[field.key] || '—'}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {preview.rows.length > rows.length ? (
        <p className="border-t border-border/50 px-3 py-2 text-[11px] text-muted-foreground">المعاينة تعرض أول {rows.length} سجلات من أصل {preview.rows.length}.</p>
      ) : null}
    </div>
  );
}

export function OfficeLaunchPanel({ draft }: Readonly<{ draft: CompanySettingsDraft }>) {
  const readiness = useMemo(() => deriveOfficeReadiness(draft), [draft]);
  const [entity, setEntity] = useState<OfficeImportEntity>('owners');
  const [preview, setPreview] = useState<OfficeImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const onEntityChange = (next: OfficeImportEntity) => {
    setEntity(next);
    setPreview(null);
    setFileName('');
    setParseError(null);
  };

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsParsing(true);
    setParseError(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const matrix = await parseOfficeImportFile(file);
      setPreview(buildCanonicalOfficeImportPreview(entity, matrix));
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'تعذر قراءة الملف');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <section className="space-y-3 border-t border-border/55 pt-4" aria-labelledby="office-launch-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="office-launch-title" className="text-sm font-black text-foreground">تشغيل المكتب</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">جهّز المكتب ثم انقل البيانات من Excel أو CSV بمعاينة كاملة قبل أي كتابة. هذه المرحلة لا تنشئ قيودًا مالية ولا تتجاوز دورة العقود.</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2 text-left" dir="rtl">
          <p className="text-[11px] font-bold text-muted-foreground">جاهزية التشغيل</p>
          <p className="text-lg font-black tabular-nums">{readiness.percent}%</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {readiness.items.map((item) => (
          <div key={item.id} className="rounded-xl border border-border/60 bg-background px-3 py-2.5">
            <div className="flex items-center gap-2">
              {item.ready ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" /> : <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />}
              <span className="text-xs font-black">{item.label}</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-muted-foreground">{item.helper}</p>
          </div>
        ))}
      </div>

      {!readiness.ready ? (
        <div className="rounded-xl border border-warning/30 bg-warning-bg px-3 py-2 text-xs" role="status">
          الخطوة التالية لإكمال إعداد المكتب: <strong>{readiness.nextAction}</strong>. يمكنك فحص ملفات الاستيراد الآن، لكن لا تعتمد تشغيل المكتب قبل اكتمال الإعداد.
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-muted/10 p-3 md:p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-44 flex-1 space-y-1 text-xs font-black">
            <span>نوع البيانات</span>
            <select
              className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={entity}
              onChange={(event) => onEntityChange(event.target.value as OfficeImportEntity)}
              aria-label="نوع بيانات الاستيراد"
            >
              {entityOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <TemplateButton entity={entity} format="xlsx" />
          <TemplateButton entity={entity} format="csv" />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground">
            <FileUp className="size-4" aria-hidden="true" />
            {isParsing ? 'جارٍ الفحص…' : 'رفع ملف وفحصه'}
            <input className="sr-only" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={isParsing} onChange={(event) => { void onFileChange(event); }} aria-label="رفع ملف CSV أو Excel للفحص" />
          </label>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-info/25 bg-info-bg px-3 py-2 text-xs text-muted-foreground">
          <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <p><strong className="text-foreground">معاينة آمنة:</strong> رفع الملف هنا لا يكتب في قاعدة البيانات. الاعتماد الفعلي يظل خلف حدود الخدمات وRPCs المعتمدة حتى لا تتحول عملية نقل البيانات إلى مسار يتجاوز قواعد MALEK.</p>
        </div>

        {parseError ? <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive" role="alert">{parseError}</div> : null}

        {preview ? (
          <div className="mt-3 space-y-3" aria-live="polite">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border px-2.5 py-1">الملف: {fileName}</span>
              <span className="rounded-full border border-border px-2.5 py-1">السجلات: {preview.rows.length}</span>
              <span className="rounded-full border border-success/30 px-2.5 py-1 text-success-text">صالحة: {preview.validRows.length}</span>
              <span className="rounded-full border border-destructive/30 px-2.5 py-1 text-destructive">مشكلات: {preview.issues.length}</span>
            </div>
            {preview.canCommit ? (
              <div className="rounded-xl border border-success/30 bg-success-bg px-3 py-2 text-xs text-success-text" role="status">الملف اجتاز الفحص بالكامل وهو جاهز لمرحلة الاعتماد عبر المسار التشغيلي.</div>
            ) : (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs" role="alert">
                <p className="font-black text-destructive">لن يتم اعتماد الملف قبل معالجة جميع المشكلات.</p>
                <ul className="mt-1.5 list-disc space-y-1 pe-4 text-muted-foreground">
                  {preview.issues.slice(0, 8).map((issue, index) => <li key={`${issue.row}-${issue.field ?? 'row'}-${index}`}>صف {issue.row}: {issue.message}</li>)}
                </ul>
                {preview.issues.length > 8 ? <p className="mt-1 text-muted-foreground">و{preview.issues.length - 8} مشكلة أخرى.</p> : null}
              </div>
            )}
            <PreviewTable preview={preview} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
