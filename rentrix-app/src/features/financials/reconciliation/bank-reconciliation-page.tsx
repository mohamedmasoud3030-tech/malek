import { useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  FileUp,
  Landmark,
  Link2,
  Plus,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { PageStateCard, WriteErrorCard } from '@/components/page-state-card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityCard } from '@/components/ui/entity-card';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { ResponsiveCardGrid } from '@/components/ui/responsive-card-grid';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
import { getTodayLocalDateString } from '../financials-date-utils';
import { summarizeReconciliation } from './bankReconciliationService';
import type {
  BankMatchCandidate,
  BankReconciliationFilters,
  BankReconciliationMatchValues,
  BankStatementImportValues,
  BankStatementLine,
  BankStatementLineFormValues,
} from './types';
import {
  useBankAccounts,
  useBankStatementLines,
  useCreateBankStatementLine,
  useIgnoreBankStatementLine,
  useImportBankStatementCsv,
  useMatchBankStatementLine,
  useSuggestedBankMatches,
} from './useBankReconciliation';

const statusLabels = {
  all: 'كل الحالات',
  unmatched: 'غير مطابقة',
  matched: 'مطابقة',
  ignored: 'متجاهلة',
} as const;

const entityLabels = {
  payment: 'دفعة',
  receipt: 'إيصال',
  expense: 'مصروف',
  manual_adjustment: 'تسوية يدوية',
} as const;

const emptyLineDraft: BankStatementLineFormValues = {
  bank_account_id: '',
  transaction_date: getTodayLocalDateString(),
  description: '',
  reference: '',
  amount: '',
};

const emptyMatchDraft: BankReconciliationMatchValues = {
  statement_line_id: '',
  matched_entity_type: 'payment',
  matched_entity_id: '',
  matched_amount: '',
  notes: '',
};

const emptyImportDraft: BankStatementImportValues = {
  bank_account_id: '',
  statement_name: '',
  csv: '',
};

function formatDate(value: string | null | undefined) {
  return formatCompanyDate(defaultCompanyLocalSettings, value ? `${value}T00:00:00` : value);
}

function statusTone(status: BankStatementLine['status']): 'green' | 'gray' | 'gold' {
  if (status === 'matched') return 'green';
  if (status === 'ignored') return 'gray';
  return 'gold';
}

export function BankReconciliationPage() {
  const [filters, setFilters] = useState<BankReconciliationFilters>({
    bankAccountId: '',
    status: 'all',
    from: '',
    to: '',
  });
  const [lineDraft, setLineDraft] = useState<BankStatementLineFormValues>(emptyLineDraft);
  const [matchDraft, setMatchDraft] = useState<BankReconciliationMatchValues>(emptyMatchDraft);
  const [importDraft, setImportDraft] = useState<BankStatementImportValues>(emptyImportDraft);
  const [lineFormOpen, setLineFormOpen] = useState(false);
  const [matchFormOpen, setMatchFormOpen] = useState(false);
  const [importFormOpen, setImportFormOpen] = useState(false);
  const [pendingIgnoreLineId, setPendingIgnoreLineId] = useState<string | null>(null);

  const accountsQuery = useBankAccounts();
  const linesQuery = useBankStatementLines(filters);
  const createLine = useCreateBankStatementLine();
  const importCsv = useImportBankStatementCsv();
  const matchLine = useMatchBankStatementLine();
  const ignoreLine = useIgnoreBankStatementLine();
  const { authorization } = useAuth();

  const lines = linesQuery.data ?? [];
  const accounts = accountsQuery.data ?? [];
  const summary = useMemo(() => summarizeReconciliation(lines), [lines]);
  const selectedLine = lines.find((line) => line.id === matchDraft.statement_line_id);
  const suggestionsQuery = useSuggestedBankMatches(selectedLine);
  const canManageReconciliation = canAccess(authorization, financialOperationPermissions.matchBankReconciliation);
  const writeError = createLine.error ?? importCsv.error ?? matchLine.error ?? ignoreLine.error;
  const pendingIgnoreLine = lines.find((line) => line.id === pendingIgnoreLineId) ?? null;
  const unmatchedLines = lines.filter((line) => line.status === 'unmatched');
  const hasFilters = Boolean(filters.bankAccountId || filters.status !== 'all' || filters.from || filters.to);

  const openManualLineForm = () => {
    setLineDraft({
      ...emptyLineDraft,
      bank_account_id: filters.bankAccountId || accounts[0]?.id || '',
    });
    setLineFormOpen(true);
  };

  const openImportForm = () => {
    setImportDraft({
      ...emptyImportDraft,
      bank_account_id: filters.bankAccountId || accounts[0]?.id || '',
    });
    setImportFormOpen(true);
  };

  const openMatchForm = () => {
    const firstLine = unmatchedLines[0];
    setMatchDraft({
      ...emptyMatchDraft,
      statement_line_id: firstLine?.id ?? '',
      matched_amount: firstLine?.amount.toString() ?? '',
    });
    setMatchFormOpen(true);
  };

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="مطابقة البنك"
        description="مراجعة حركات كشف البنك ومطابقتها مع الدفعات أو الإيصالات أو المصروفات، بدون تكديس نماذج الإدخال داخل مساحة النتائج."
        secondaryActions={(
          <>
            <Button variant="secondary" disabled={!canManageReconciliation || accounts.length === 0} onClick={openImportForm}>
              <FileUp className="me-2 size-4" aria-hidden="true" />
              استيراد CSV
            </Button>
            <Button variant="secondary" disabled={!canManageReconciliation || unmatchedLines.length === 0} onClick={openMatchForm}>
              <Link2 className="me-2 size-4" aria-hidden="true" />
              مطابقة حركة
            </Button>
          </>
        )}
        primaryAction={(
          <Button
            disabled={!canManageReconciliation || accounts.length === 0}
            title={canManageReconciliation ? undefined : 'ليس لديك صلاحية مطابقة البنك'}
            onClick={openManualLineForm}
          >
            <Plus className="me-2 size-4" aria-hidden="true" />
            حركة يدوية
          </Button>
        )}
      />

      <ResponsiveCardGrid desktopColumns={4}>
        <KpiCard label="إجمالي الحركات" value={summary.totalLines} sub="ضمن الفلاتر الحالية" icon={Landmark} accent="primary" />
        <KpiCard label="غير مطابقة" value={summary.unmatchedCount} sub="تحتاج إلى مراجعة" icon={Unlink} accent="amber" />
        <KpiCard label="مطابقة" value={summary.matchedCount} sub="تم ربطها بسجلات النظام" icon={CheckCircle2} accent="emerald" />
        <KpiCard label="صافي غير مطابق" value={formatCompanyMoney(defaultCompanyLocalSettings, summary.unmatchedAmount)} sub="إجمالي المبالغ غير المحسومة" icon={Banknote} accent="rose" />
      </ResponsiveCardGrid>

      <FilterBar
        filters={(
          <>
            <Select
              aria-label="الحساب البنكي"
              value={filters.bankAccountId}
              onChange={(event) => setFilters({ ...filters, bankAccountId: event.target.value })}
            >
              <option value="">كل الحسابات</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
            </Select>
            <Select
              aria-label="حالة المطابقة"
              value={filters.status}
              onChange={(event) => setFilters({ ...filters, status: event.target.value as BankReconciliationFilters['status'] })}
            >
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Input aria-label="من تاريخ" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
            <Input aria-label="إلى تاريخ" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
          </>
        )}
        actions={hasFilters ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setFilters({ bankAccountId: '', status: 'all', from: '', to: '' })}
          >
            مسح الفلاتر
          </Button>
        ) : undefined}
      />

      {writeError ? <WriteErrorCard message={writeError instanceof Error ? writeError.message : 'تعذر حفظ التغيير في مطابقة البنك.'} /> : null}
      {accountsQuery.isLoading || linesQuery.isLoading ? <PageStateCard title="جارٍ تحميل حركات البنك..." /> : null}
      {!accountsQuery.isLoading && accounts.length === 0 ? (
        <PageStateCard
          title="لا توجد حسابات بنكية بعد"
          description="أضف حساباً بنكياً قبل تسجيل أو استيراد حركات كشف البنك."
        />
      ) : null}

      {!linesQuery.isLoading && lines.length === 0 ? (
        <PageStateCard
          title="لا توجد حركات كشف ضمن الفلاتر"
          description={hasFilters ? 'غيّر الفلاتر أو امسحها لعرض نتائج أخرى.' : 'أضف حركة يدوية أو استورد كشفاً بنكياً للبدء.'}
        />
      ) : (
        <BankStatementLinesTable
          lines={lines}
          onIgnore={(id) => { if (canManageReconciliation) setPendingIgnoreLineId(id); }}
          onMatch={(line) => {
            if (!canManageReconciliation || line.status !== 'unmatched') return;
            setMatchDraft({
              ...emptyMatchDraft,
              statement_line_id: line.id,
              matched_amount: line.amount.toString(),
            });
            setMatchFormOpen(true);
          }}
          isIgnoring={!canManageReconciliation || ignoreLine.isPending}
        />
      )}

      <EntityForm.Overlay
        open={lineFormOpen}
        onOpenChange={(open) => { if (!createLine.isPending) setLineFormOpen(open); }}
        title="إضافة حركة كشف يدوية"
        description="استخدم هذا النموذج للحركات التي لم تُستورد من كشف CSV."
      >
        <EntityForm.Root
          aria-busy={createLine.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (!canManageReconciliation) return;
            createLine.mutate(lineDraft, {
              onSuccess: () => {
                setLineDraft(emptyLineDraft);
                setLineFormOpen(false);
              },
            });
          }}
        >
          <EntityForm.Section title="بيانات الحركة" description="أدخل الحساب والتاريخ والوصف والمبلغ كما ظهر في كشف البنك.">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="الحساب البنكي">
                <Select required value={lineDraft.bank_account_id} onChange={(event) => setLineDraft({ ...lineDraft, bank_account_id: event.target.value })}>
                  <option value="">اختر الحساب</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
                </Select>
              </EntityForm.Field>
              <EntityForm.Field label="تاريخ الحركة">
                <Input required type="date" value={lineDraft.transaction_date} onChange={(event) => setLineDraft({ ...lineDraft, transaction_date: event.target.value })} />
              </EntityForm.Field>
              <EntityForm.Field label="الوصف" className="sm:col-span-2">
                <Input value={lineDraft.description} onChange={(event) => setLineDraft({ ...lineDraft, description: event.target.value })} placeholder="وصف الحركة" />
              </EntityForm.Field>
              <EntityForm.Field label="المرجع">
                <Input value={lineDraft.reference} onChange={(event) => setLineDraft({ ...lineDraft, reference: event.target.value })} placeholder="رقم المرجع" />
              </EntityForm.Field>
              <EntityForm.Field label="المبلغ">
                <Input required type="number" step="0.01" inputMode="decimal" value={lineDraft.amount} onChange={(event) => setLineDraft({ ...lineDraft, amount: event.target.value })} placeholder="المبلغ +/-" />
              </EntityForm.Field>
            </div>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={createLine.isPending ? 'جارٍ الحفظ...' : 'حفظ الحركة'}
            onCancel={() => setLineFormOpen(false)}
            isSubmitting={createLine.isPending}
            submitDisabled={!canManageReconciliation || !lineDraft.bank_account_id || !lineDraft.amount}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={importFormOpen}
        onOpenChange={(open) => { if (!importCsv.isPending) setImportFormOpen(open); }}
        title="استيراد كشف البنك"
        description="ألصق بيانات CSV بالحقل أدناه. لن يتم تغيير قواعد المطابقة أو الحسابات."
      >
        <EntityForm.Root
          aria-busy={importCsv.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (!canManageReconciliation) return;
            importCsv.mutate(importDraft, {
              onSuccess: () => {
                setImportDraft(emptyImportDraft);
                setImportFormOpen(false);
              },
            });
          }}
        >
          <EntityForm.Section title="بيانات الكشف" description="اختر الحساب وأدخل اسماً واضحاً للفترة ثم ألصق CSV.">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="الحساب البنكي">
                <Select required value={importDraft.bank_account_id} onChange={(event) => setImportDraft({ ...importDraft, bank_account_id: event.target.value })}>
                  <option value="">اختر الحساب</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
                </Select>
              </EntityForm.Field>
              <EntityForm.Field label="اسم الكشف / الفترة">
                <Input value={importDraft.statement_name} onChange={(event) => setImportDraft({ ...importDraft, statement_name: event.target.value })} placeholder="مثال: يوليو 2026" />
              </EntityForm.Field>
            </div>
            <EntityForm.Field label="بيانات CSV">
              <Textarea
                value={importDraft.csv}
                onChange={(event) => setImportDraft({ ...importDraft, csv: event.target.value })}
                placeholder={'date,description,reference,amount\n2026-07-01,تحصيل إيجار,REC-100,250.00'}
                className="min-h-40 font-mono text-xs"
              />
            </EntityForm.Field>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={importCsv.isPending ? 'جارٍ الاستيراد...' : 'استيراد CSV'}
            onCancel={() => setImportFormOpen(false)}
            isSubmitting={importCsv.isPending}
            submitDisabled={!canManageReconciliation || !importDraft.bank_account_id || !importDraft.csv.trim()}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <EntityForm.Overlay
        open={matchFormOpen}
        onOpenChange={(open) => { if (!matchLine.isPending) setMatchFormOpen(open); }}
        title="مطابقة حركة بنكية"
        description="اختر الحركة والسجل المقابل، ثم راجع مبلغ المطابقة قبل التأكيد."
      >
        <EntityForm.Root
          aria-busy={matchLine.isPending}
          onSubmit={(event) => {
            event.preventDefault();
            if (!canManageReconciliation || !selectedLine) return;
            matchLine.mutate(matchDraft, {
              onSuccess: () => {
                setMatchDraft(emptyMatchDraft);
                setMatchFormOpen(false);
              },
            });
          }}
        >
          <EntityForm.Section title="الحركة والسجل" description="الاقتراحات تعتمد على التاريخ والمبلغ فقط وتحتاج مراجعتك.">
            <EntityForm.Field label="الحركة غير المطابقة">
              <Select
                required
                value={matchDraft.statement_line_id}
                onChange={(event) => {
                  const line = lines.find((item) => item.id === event.target.value);
                  setMatchDraft({
                    ...matchDraft,
                    statement_line_id: event.target.value,
                    matched_amount: line?.amount.toString() ?? matchDraft.matched_amount,
                  });
                }}
              >
                <option value="">اختر حركة غير مطابقة</option>
                {unmatchedLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {formatDate(line.transaction_date)} — {line.description} — {formatCompanyMoney(defaultCompanyLocalSettings, line.amount)}
                  </option>
                ))}
              </Select>
            </EntityForm.Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="نوع السجل">
                <Select
                  value={matchDraft.matched_entity_type}
                  onChange={(event) => setMatchDraft({ ...matchDraft, matched_entity_type: event.target.value as BankReconciliationMatchValues['matched_entity_type'] })}
                >
                  {Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </EntityForm.Field>
              <EntityForm.Field label="معرّف السجل">
                <Input required value={matchDraft.matched_entity_id} onChange={(event) => setMatchDraft({ ...matchDraft, matched_entity_id: event.target.value })} placeholder="معرف السجل" />
              </EntityForm.Field>
              <EntityForm.Field label="مبلغ المطابقة">
                <Input required type="number" step="0.01" inputMode="decimal" value={matchDraft.matched_amount} onChange={(event) => setMatchDraft({ ...matchDraft, matched_amount: event.target.value })} placeholder="مبلغ المطابقة" />
              </EntityForm.Field>
              <EntityForm.Field label="ملاحظات">
                <Input value={matchDraft.notes} onChange={(event) => setMatchDraft({ ...matchDraft, notes: event.target.value })} placeholder="اختياري" />
              </EntityForm.Field>
            </div>

            {selectedLine ? (
              <SuggestedMatches
                candidates={suggestionsQuery.data ?? []}
                isLoading={suggestionsQuery.isLoading}
                isInteractive={canManageReconciliation}
                onUse={(candidate) => setMatchDraft({
                  ...matchDraft,
                  matched_entity_type: candidate.entity_type,
                  matched_entity_id: candidate.entity_id,
                  matched_amount: candidate.amount.toString(),
                })}
              />
            ) : (
              <p className="text-sm text-muted-foreground">اختر حركة غير مطابقة لعرض الاقتراحات.</p>
            )}
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={matchLine.isPending ? 'جارٍ المطابقة...' : 'تأكيد المطابقة'}
            onCancel={() => setMatchFormOpen(false)}
            isSubmitting={matchLine.isPending}
            submitDisabled={!canManageReconciliation || !selectedLine || !matchDraft.matched_entity_id || !matchDraft.matched_amount}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog
        open={Boolean(pendingIgnoreLine)}
        onOpenChange={(open) => { if (!open) setPendingIgnoreLineId(null); }}
        title="تجاهل حركة كشف البنك؟"
        description={pendingIgnoreLine ? `سيتم استبعاد حركة ${pendingIgnoreLine.description} بمبلغ ${formatCompanyMoney(defaultCompanyLocalSettings, pendingIgnoreLine.amount)} من قائمة الحركات غير المطابقة. يمكن مراجعتها لاحقاً عبر فلتر المتجاهلة.` : undefined}
        confirmLabel="تجاهل الحركة"
        variant="warning"
        isLoading={ignoreLine.isPending}
        onConfirm={() => {
          if (!pendingIgnoreLineId || !canManageReconciliation) return;
          ignoreLine.mutate(pendingIgnoreLineId, { onSuccess: () => setPendingIgnoreLineId(null) });
        }}
      />
    </PageLayout>
  );
}

function BankStatementLinesTable({
  lines,
  onIgnore,
  onMatch,
  isIgnoring,
}: Readonly<{
  lines: BankStatementLine[];
  onIgnore: (id: string) => void;
  onMatch: (line: BankStatementLine) => void;
  isIgnoring: boolean;
}>) {
  const columns: ColumnDef<BankStatementLine>[] = [
    { key: 'date', header: 'التاريخ', render: (line) => formatDate(line.transaction_date) },
    { key: 'description', header: 'الوصف', render: (line) => <span className="font-bold">{line.description}</span> },
    { key: 'reference', header: 'المرجع', render: (line) => line.reference ?? '—' },
    { key: 'amount', header: 'المبلغ', render: (line) => <span className="font-black tabular-nums">{formatCompanyMoney(defaultCompanyLocalSettings, line.amount)}</span> },
    { key: 'status', header: 'الحالة', render: (line) => <StatusBadge tone={statusTone(line.status)}>{statusLabels[line.status]}</StatusBadge> },
    {
      key: 'action',
      header: 'الإجراء',
      render: (line) => line.status === 'unmatched' ? (
        <div className="flex gap-2">
          <Button variant="secondary" className="min-h-10 px-3 text-xs" onClick={() => onMatch(line)}>مطابقة</Button>
          <Button variant="secondary" className="min-h-10 px-3 text-xs" disabled={isIgnoring} onClick={() => onIgnore(line.id)}>تجاهل</Button>
        </div>
      ) : '—',
    },
  ];

  return (
    <EntityTable
      aria-label="جدول حركات كشف البنك"
      rows={lines}
      columns={columns}
      keyOf={(line) => line.id}
      emptyTitle="لا توجد حركات كشف"
      emptyDescription="لا توجد حركات تطابق الفلاتر الحالية."
      renderMobileCard={(line) => (
        <EntityCard
          id={line.id}
          name={line.description}
          subtitle={formatDate(line.transaction_date)}
          avatarIcon={Landmark}
          badge={<StatusBadge tone={statusTone(line.status)}>{statusLabels[line.status]}</StatusBadge>}
          stats={(
            <div className="grid grid-cols-2 gap-3">
              <div><span className="block text-[10px] text-muted-foreground">المرجع</span><strong className="mt-1 block truncate text-xs">{line.reference ?? '—'}</strong></div>
              <div><span className="block text-[10px] text-muted-foreground">المبلغ</span><strong className="mt-1 block text-sm tabular-nums">{formatCompanyMoney(defaultCompanyLocalSettings, line.amount)}</strong></div>
            </div>
          )}
          actions={line.status === 'unmatched' ? [
            { label: 'مطابقة', icon: ShieldCheck, variant: 'default', onClick: () => onMatch(line) },
            { label: 'تجاهل', icon: Unlink, onClick: () => onIgnore(line.id) },
          ] : undefined}
        />
      )}
    />
  );
}

function SuggestedMatches({
  candidates,
  isLoading,
  isInteractive,
  onUse,
}: Readonly<{
  candidates: BankMatchCandidate[];
  isLoading: boolean;
  isInteractive: boolean;
  onUse: (candidate: BankMatchCandidate) => void;
}>) {
  if (isLoading) return <p className="text-sm text-muted-foreground">جارٍ تحميل الاقتراحات...</p>;
  if (candidates.length === 0) return <p className="text-sm text-muted-foreground">لا توجد اقتراحات تلقائية بنفس التاريخ والمبلغ.</p>;

  return (
    <div className="grid gap-2 rounded-2xl border border-border/60 bg-background/65 p-3">
      <p className="text-sm font-black">اقتراحات مطابقة محتملة</p>
      {candidates.map((candidate) => (
        <button
          key={`${candidate.entity_type}:${candidate.entity_id}`}
          type="button"
          className="min-h-11 rounded-xl border border-border bg-card p-3 text-right text-sm transition hover:border-primary/35 hover:bg-primary/5 disabled:opacity-50"
          disabled={!isInteractive}
          onClick={() => onUse(candidate)}
        >
          <span className="font-bold">{entityLabels[candidate.entity_type]}</span>
          <span className="mx-2">—</span>
          <span>{candidate.label}</span>
          <span className="mx-2">—</span>
          <span className="font-black tabular-nums">{formatCompanyMoney(defaultCompanyLocalSettings, candidate.amount)}</span>
        </button>
      ))}
    </div>
  );
}
