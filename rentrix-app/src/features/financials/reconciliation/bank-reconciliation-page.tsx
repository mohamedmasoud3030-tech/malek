import { MONEY_STEP } from '@/lib/money';
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
import { DataRefreshAlert } from '@/components/data-refresh-alert';
import { EmbeddableWorkspace } from '@/components/layout/embeddable-workspace';
import { PageStateCard, WriteErrorCard } from '@/components/page-state-card';
import { ActiveFilterBar, type ActiveFilterItem } from '@/components/ui/active-filter-bar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EntityForm } from '@/components/ui/entity-form';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { ErrorState } from '@/components/ui/error-state';
import { FilterBar } from '@/components/ui/filter-bar';
import { Input } from '@/components/ui/input';
import { FinanceKpiGrid, FinanceKpiCard } from '../components/finance-reporting-visual-foundations';
import { Select } from '@/components/ui/select';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
import type { CompanySettingsContract } from '@/lib/companySettings';
import { useCompanySettingsContract } from '@/features/settings/useCompanySettings';
import { BankCsvImportWorkflow } from './bank-csv-import-workflow';
import type {
  BankMatchCandidate,
  BankReconciliationFilters,
  BankReconciliationMatchValues,
  BankStatementLine,
} from './types';
import {
  statusLabels,
  entityLabels,
  emptyMatchDraft,
  useBankReconciliationController,
} from './useBankReconciliationController';

function formatDate(settings: CompanySettingsContract, value: string | null | undefined) {
  return formatCompanyDate(settings, value ? `${value}T00:00:00` : value);
}

function statusTone(status: BankStatementLine['status']): 'success' | 'neutral' | 'warning' {
  if (status === 'matched') return 'success';
  if (status === 'ignored') return 'neutral';
  return 'warning';
}

export type BankReconciliationWorkspaceProps = Readonly<{
  embedded?: boolean;
}>;

export function BankReconciliationWorkspace({ embedded = false }: BankReconciliationWorkspaceProps) {
  const ctrl = useBankReconciliationController();
  const companySettings = useCompanySettingsContract();
  const hasReadError = ctrl.accountsQuery.isError || ctrl.linesQuery.isError;
  const hasBlockingAccountsError = ctrl.accountsQuery.isError && ctrl.accounts.length === 0;
  const hasBlockingLinesError = ctrl.linesQuery.isError && ctrl.lines.length === 0;
  const hasStaleReadError = hasReadError && !hasBlockingAccountsError && !hasBlockingLinesError;
  const canMutateCurrentSnapshot = ctrl.canManageReconciliation && !hasReadError;
  const activeFilters: ActiveFilterItem[] = [];
  if (ctrl.filters.bankAccountId) {
    const account = ctrl.accounts.find((item) => item.id === ctrl.filters.bankAccountId);
    activeFilters.push({
      key: 'bankAccountId',
      label: 'الحساب',
      value: account?.account_name ?? ctrl.filters.bankAccountId,
      onRemove: () => ctrl.setFilters({ ...ctrl.filters, bankAccountId: '' }),
    });
  }
  if (ctrl.filters.status !== 'all') {
    activeFilters.push({
      key: 'status',
      label: 'الحالة',
      value: statusLabels[ctrl.filters.status],
      onRemove: () => ctrl.setFilters({ ...ctrl.filters, status: 'all' }),
    });
  }
  if (ctrl.filters.from) {
    activeFilters.push({
      key: 'from',
      label: 'من',
      value: formatDate(companySettings, ctrl.filters.from),
      onRemove: () => ctrl.setFilters({ ...ctrl.filters, from: '' }),
    });
  }
  if (ctrl.filters.to) {
    activeFilters.push({
      key: 'to',
      label: 'إلى',
      value: formatDate(companySettings, ctrl.filters.to),
      onRemove: () => ctrl.setFilters({ ...ctrl.filters, to: '' }),
    });
  }

  return (
    <EmbeddableWorkspace
      visualVariant="malek-pro"
      embedded={embedded}
      title="المطابقة البنكية"
      description="مراجعة حركات كشف البنك ومطابقتها مع الدفعات أو الإيصالات أو المصروفات."
      secondaryActions={(
        <>
          <Button variant="secondary" className="min-h-11" disabled={!canMutateCurrentSnapshot || ctrl.accounts.length === 0} onClick={ctrl.openImportForm}>
            <FileUp className="me-2 size-4" aria-hidden="true" />
            استيراد CSV
          </Button>
          <Button variant="secondary" className="min-h-11" disabled={!canMutateCurrentSnapshot || ctrl.unmatchedLines.length === 0} onClick={ctrl.openMatchForm}>
            <Link2 className="me-2 size-4" aria-hidden="true" />
            مطابقة حركة
          </Button>
        </>
      )}
      primaryAction={(
        <Button
          className="min-h-11"
          disabled={!canMutateCurrentSnapshot || ctrl.accounts.length === 0}
          title={canMutateCurrentSnapshot ? undefined : 'ليس لديك صلاحية مطابقة البنك'}
          onClick={() => { if (canMutateCurrentSnapshot) ctrl.openManualLineForm(); }}
        >
          <Plus className="me-2 size-4" aria-hidden="true" />
          حركة يدوية
        </Button>
      )}
    >
      {/* KPI zeros from failed loads would look like “no bank activity”. Hide them until a successful read. */}
      {!hasBlockingAccountsError && !hasBlockingLinesError ? (
        <FinanceKpiGrid desktopColumns={4}>
          <FinanceKpiCard label="إجمالي الحركات" value={ctrl.summary.totalLines} sub="ضمن الفلاتر الحالية" icon={Landmark} accent="primary" />
          <FinanceKpiCard label="غير مطابقة" value={ctrl.summary.unmatchedCount} sub="تحتاج إلى مراجعة" icon={Unlink} accent="primary" trend="down" trendValue="مراجعة" onDrill={() => ctrl.setFilters({ ...ctrl.filters, status: 'unmatched' })} />
          <FinanceKpiCard label="مطابقة" value={ctrl.summary.matchedCount} sub="تم ربطها بسجلات النظام" icon={CheckCircle2} accent="primary" trend="up" trendValue="مطابق" onDrill={() => ctrl.setFilters({ ...ctrl.filters, status: 'matched' })} />
          <FinanceKpiCard
            label="صافي غير مطابق"
            value={formatCompanyMoney(companySettings, ctrl.summary.unmatchedAmount)}
            sub="إجمالي المبالغ غير المحسومة"
            icon={Banknote}
            accent="primary"
            unit={companySettings.defaultCurrency}
          />
        </FinanceKpiGrid>
      ) : null}

      <FilterBar
        filters={(
          <>
            <Select
              aria-label="الحساب البنكي"
              value={ctrl.filters.bankAccountId}
              onChange={(event) => ctrl.setFilters({ ...ctrl.filters, bankAccountId: event.target.value })}
              className="min-h-11 w-full sm:w-52"
            >
              <option value="">كل الحسابات</option>
              {ctrl.accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
            </Select>
            <Select
              aria-label="حالة المطابقة"
              value={ctrl.filters.status}
              onChange={(event) => ctrl.setFilters({ ...ctrl.filters, status: event.target.value as BankReconciliationFilters['status'] })}
              className="min-h-11 w-full sm:w-44"
            >
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
            <Input className="min-h-11 w-full sm:w-40" aria-label="من تاريخ" type="date" value={ctrl.filters.from} onChange={(event) => ctrl.setFilters({ ...ctrl.filters, from: event.target.value })} />
            <Input className="min-h-11 w-full sm:w-40" aria-label="إلى تاريخ" type="date" value={ctrl.filters.to} onChange={(event) => ctrl.setFilters({ ...ctrl.filters, to: event.target.value })} />
          </>
        )}
      />
      <ActiveFilterBar
        filters={activeFilters}
        onClearAll={() => ctrl.setFilters({ bankAccountId: '', status: 'all', from: '', to: '' })}
      />

      {hasStaleReadError ? (
        <DataRefreshAlert
          title="تعذر تأكيد أحدث بيانات المطابقة البنكية"
          description="نعرض آخر بيانات متاحة للقراءة فقط. تم إيقاف الاستيراد والمطابقة والتجاهل حتى ينجح التحديث."
          onRetry={() => { void Promise.all([ctrl.accountsQuery.refetch(), ctrl.linesQuery.refetch()]); }}
        />
      ) : null}

      {ctrl.writeError ? <WriteErrorCard message={ctrl.writeError instanceof Error ? ctrl.writeError.message : 'تعذر حفظ التغيير في مطابقة البنك.'} /> : null}
      {ctrl.accountsQuery.isLoading || ctrl.linesQuery.isLoading ? <PageStateCard title="جارٍ تحميل حركات البنك..." /> : null}

      {/* Read failures must never render as empty lists (false “no data” signal). */}
      {hasBlockingAccountsError ? (
        <ErrorState
          title="تعذر تحميل الحسابات البنكية"
          description="تحقق من الاتصال والصلاحيات ثم أعد المحاولة. لن نعرض قائمة فارغة عند فشل التحميل."
          error={ctrl.accountsQuery.error}
          onRetry={() => { void ctrl.accountsQuery.refetch(); }}
        />
      ) : null}
      {hasBlockingLinesError ? (
        <ErrorState
          title="تعذر تحميل حركات كشف البنك"
          description="تحقق من الاتصال أو الفلاتر ثم أعد المحاولة. الخطأ لا يُعرض كـ«لا توجد حركات»."
          error={ctrl.linesQuery.error}
          onRetry={() => { void ctrl.linesQuery.refetch(); }}
        />
      ) : null}

      {!ctrl.accountsQuery.isLoading && !hasBlockingAccountsError && ctrl.accounts.length === 0 ? (
        <PageStateCard
          title="لا توجد حسابات بنكية بعد"
          description="أضف حساباً بنكياً قبل تسجيل أو استيراد حركات كشف البنك."
        />
      ) : null}

      {!ctrl.linesQuery.isLoading && !hasBlockingLinesError && ctrl.lines.length === 0 ? (
        <PageStateCard
          title="لا توجد حركات كشف ضمن الفلاتر"
          description={ctrl.hasFilters ? 'غيّر الفلاتر أو امسحها لعرض نتائج أخرى.' : 'أضف حركة يدوية أو استورد كشفاً بنكياً للبدء.'}
        />
      ) : !hasBlockingLinesError ? (
        <BankStatementLinesTable
          companySettings={companySettings}
          lines={ctrl.lines}
          onIgnore={(id) => { if (canMutateCurrentSnapshot) ctrl.setPendingIgnoreLineId(id); }}
          onMatch={(line) => {
            if (!canMutateCurrentSnapshot || line.status !== 'unmatched') return;
            ctrl.setMatchDraft({
              ...emptyMatchDraft,
              statement_line_id: line.id,
              matched_amount: line.amount.toString(),
            });
            ctrl.setMatchFormOpen(true);
          }}
          isIgnoring={!canMutateCurrentSnapshot || ctrl.ignoreLine.isPending}
        />
      ) : null}

      <EntityForm.Overlay
        open={ctrl.lineFormOpen}
        onOpenChange={(open) => { if (!ctrl.createLine.isPending) ctrl.setLineFormOpen(open); }}
        title="إضافة حركة كشف يدوية"
        description="استخدم هذا النموذج للحركات التي لم تُستورد من كشف CSV."
        visualVariant="operational"
      >
        <EntityForm.Root aria-busy={ctrl.createLine.isPending} onSubmit={ctrl.handleCreateLineSubmit}>
          <EntityForm.Section title="بيانات الحركة" description="أدخل الحساب والتاريخ والوصف والمبلغ كما ظهر في كشف البنك.">
            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="الحساب البنكي *">
                <Select required value={ctrl.lineDraft.bank_account_id} onChange={(event) => ctrl.setLineDraft({ ...ctrl.lineDraft, bank_account_id: event.target.value })}>
                  <option value="">اختر الحساب</option>
                  {ctrl.accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
                </Select>
              </EntityForm.Field>
              <EntityForm.Field label="تاريخ الحركة *">
                <Input required type="date" value={ctrl.lineDraft.transaction_date} onChange={(event) => ctrl.setLineDraft({ ...ctrl.lineDraft, transaction_date: event.target.value })} />
              </EntityForm.Field>
              <EntityForm.Field label="الوصف" className="sm:col-span-2">
                <Input value={ctrl.lineDraft.description} onChange={(event) => ctrl.setLineDraft({ ...ctrl.lineDraft, description: event.target.value })} placeholder="وصف الحركة" />
              </EntityForm.Field>
              <EntityForm.Field label="المرجع">
                <Input value={ctrl.lineDraft.reference} onChange={(event) => ctrl.setLineDraft({ ...ctrl.lineDraft, reference: event.target.value })} placeholder="رقم المرجع" />
              </EntityForm.Field>
              <EntityForm.Field label={`المبلغ (${companySettings.defaultCurrency}) *`}>
                <Input required type="number" step={MONEY_STEP} inputMode="decimal" dir="ltr" value={ctrl.lineDraft.amount} onChange={(event) => ctrl.setLineDraft({ ...ctrl.lineDraft, amount: event.target.value })} placeholder="المبلغ +/-" />
              </EntityForm.Field>
            </div>
          </EntityForm.Section>
          <EntityForm.Actions
            submitLabel={ctrl.createLine.isPending ? 'جارٍ الحفظ...' : 'حفظ الحركة'}
            onCancel={() => ctrl.setLineFormOpen(false)}
            isSubmitting={ctrl.createLine.isPending}
            submitDisabled={!ctrl.canManageReconciliation || !ctrl.lineDraft.bank_account_id || !ctrl.lineDraft.transaction_date || !ctrl.lineDraft.amount}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <BankCsvImportWorkflow
        open={ctrl.importFormOpen}
        onOpenChange={ctrl.setImportFormOpen}
        defaultBankAccountId={ctrl.filters.bankAccountId || (ctrl.accounts[0]?.id ?? '')}
        canManage={ctrl.canManageReconciliation}
        onCompleted={(result) => {
          ctrl.setFilters({ ...ctrl.filters, bankAccountId: result.bank_account_id });
          void ctrl.linesQuery.refetch();
        }}
      />

      <EntityForm.Overlay
        open={ctrl.matchFormOpen}
        onOpenChange={(open) => { if (!ctrl.matchLine.isPending) ctrl.setMatchFormOpen(open); }}
        title="مطابقة حركة بنكية"
        description="اختر الحركة والسجل المقابل، ثم راجع مبلغ المطابقة قبل التأكيد."
        visualVariant="operational"
      >
        <EntityForm.Root aria-busy={ctrl.matchLine.isPending} onSubmit={ctrl.handleMatchLineSubmit}>
          <EntityForm.Section title="الحركة والسجل" description="الاقتراحات تعتمد على التاريخ والمبلغ فقط وتحتاج مراجعتك.">
            <EntityForm.Field label="الحركة غير المطابقة *">
              <Select
                required
                value={ctrl.matchDraft.statement_line_id}
                onChange={(event) => {
                  const line = ctrl.lines.find((item) => item.id === event.target.value);
                  ctrl.setMatchDraft({
                    ...ctrl.matchDraft,
                    statement_line_id: event.target.value,
                    matched_amount: line?.amount.toString() ?? ctrl.matchDraft.matched_amount,
                  });
                }}
              >
                <option value="">اختر حركة غير مطابقة</option>
                {ctrl.unmatchedLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {formatDate(companySettings, line.transaction_date)} — {line.description} — {formatCompanyMoney(companySettings, line.amount)}
                  </option>
                ))}
              </Select>
            </EntityForm.Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <EntityForm.Field label="نوع السجل">
                <Select
                  value={ctrl.matchDraft.matched_entity_type}
                  onChange={(event) => ctrl.setMatchDraft({ ...ctrl.matchDraft, matched_entity_type: event.target.value as BankReconciliationMatchValues['matched_entity_type'] })}
                >
                  {Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </EntityForm.Field>
              <EntityForm.Field label="معرّف السجل *">
                <Input required value={ctrl.matchDraft.matched_entity_id} onChange={(event) => ctrl.setMatchDraft({ ...ctrl.matchDraft, matched_entity_id: event.target.value })} placeholder="معرف السجل" />
              </EntityForm.Field>
              <EntityForm.Field label={`مبلغ المطابقة (${companySettings.defaultCurrency}) *`}>
                <Input required type="number" step={MONEY_STEP} inputMode="decimal" dir="ltr" value={ctrl.matchDraft.matched_amount} onChange={(event) => ctrl.setMatchDraft({ ...ctrl.matchDraft, matched_amount: event.target.value })} placeholder="مبلغ المطابقة" />
              </EntityForm.Field>
              <EntityForm.Field label="ملاحظات">
                <Input value={ctrl.matchDraft.notes} onChange={(event) => ctrl.setMatchDraft({ ...ctrl.matchDraft, notes: event.target.value })} placeholder="اختياري" />
              </EntityForm.Field>
            </div>

            {ctrl.selectedLine ? (
              <SuggestedMatches
                companySettings={companySettings}
                candidates={ctrl.suggestionsQuery.data ?? []}
                isLoading={ctrl.suggestionsQuery.isLoading}
                isInteractive={ctrl.canManageReconciliation}
                onUse={(candidate) => ctrl.setMatchDraft({
                  ...ctrl.matchDraft,
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
            submitLabel={ctrl.matchLine.isPending ? 'جارٍ المطابقة...' : 'تأكيد المطابقة'}
            onCancel={() => ctrl.setMatchFormOpen(false)}
            isSubmitting={ctrl.matchLine.isPending}
            submitDisabled={!ctrl.canManageReconciliation || !ctrl.selectedLine || !ctrl.matchDraft.matched_entity_id || !ctrl.matchDraft.matched_amount}
          />
        </EntityForm.Root>
      </EntityForm.Overlay>

      <ConfirmDialog
        open={Boolean(ctrl.pendingIgnoreLine)}
        onOpenChange={(open) => { if (!open) ctrl.setPendingIgnoreLineId(null); }}
        title="تجاهل حركة كشف البنك؟"
        description={ctrl.pendingIgnoreLine ? `سيتم استبعاد حركة ${ctrl.pendingIgnoreLine.description} بمبلغ ${formatCompanyMoney(companySettings, ctrl.pendingIgnoreLine.amount)} من قائمة الحركات غير المطابقة. يمكن مراجعتها لاحقاً عبر فلتر المتجاهلة.` : undefined}
        confirmLabel="تجاهل الحركة"
        variant="warning"
        isLoading={ctrl.ignoreLine.isPending}
        onConfirm={ctrl.handleIgnoreLineConfirm}
      />
    </EmbeddableWorkspace>
  );
}

export function BankReconciliationPage() {
  return <BankReconciliationWorkspace />;
}

function BankStatementLinesTable({
  companySettings,
  lines,
  onIgnore,
  onMatch,
  isIgnoring,
}: Readonly<{
  companySettings: CompanySettingsContract;
  lines: BankStatementLine[];
  onIgnore: (id: string) => void;
  onMatch: (line: BankStatementLine) => void;
  isIgnoring: boolean;
}>) {
  const columns: ColumnDef<BankStatementLine>[] = [
    { key: 'date', header: 'التاريخ', priority: 'secondary', render: (line) => formatDate(companySettings, line.transaction_date) },
    { key: 'description', header: 'الوصف', priority: 'identity', render: (line) => <span className="font-bold">{line.description}</span> },
    { key: 'reference', header: 'المرجع', priority: 'detail', render: (line) => line.reference ?? '—' },
    {
      key: 'amount',
      header: 'المبلغ',
      priority: 'primary',
      render: (line) => <span dir="ltr" className="font-black tabular-nums">{formatCompanyMoney(companySettings, line.amount)}</span>,
    },
    {
      key: 'status',
      header: 'الحالة',
      priority: 'secondary',
      render: (line) => <StatusBadge tone={statusTone(line.status)}>{statusLabels[line.status]}</StatusBadge>,
    },
    {
      key: 'action',
      header: 'الإجراء',
      priority: 'actions',
      render: (line) => (line.status === 'unmatched' ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="min-h-11 px-3 text-xs" onClick={() => onMatch(line)}>مطابقة</Button>
          <Button variant="secondary" className="min-h-11 px-3 text-xs" disabled={isIgnoring} onClick={() => onIgnore(line.id)}>تجاهل</Button>
        </div>
      ) : '—'),
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
    />
  );
}

function SuggestedMatches({
  companySettings,
  candidates,
  isLoading,
  isInteractive,
  onUse,
}: Readonly<{
  companySettings: CompanySettingsContract;
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
          className="min-h-11 rounded-xl border border-border bg-card p-3 text-start text-sm transition hover:border-primary/35 hover:bg-primary/5 disabled:opacity-50"
          disabled={!isInteractive}
          onClick={() => onUse(candidate)}
        >
          <span className="font-bold">{entityLabels[candidate.entity_type]}</span>
          <span className="mx-2">—</span>
          <span>{candidate.label}</span>
          <span className="mx-2">—</span>
          <span dir="ltr" className="font-black tabular-nums">{formatCompanyMoney(companySettings, candidate.amount)}</span>
        </button>
      ))}
    </div>
  );
}
