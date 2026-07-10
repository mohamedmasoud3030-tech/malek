import { useMemo, useState } from 'react';
import { Landmark, Link2, Plus, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityTable, type ColumnDef } from '@/components/ui/entity-table';
import { InlineStatCard } from '@/components/ui/inline-stat-card';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { PageLayout } from '@/components/layout/page-layout';
import { PageStateCard, WriteErrorCard } from '@/components/page-state-card';
import { Select } from '@/components/ui/select';
import { canAccess, financialOperationPermissions } from '@/features/auth/permissions';
import { useAuth } from '@/hooks/use-auth';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { defaultCompanyLocalSettings } from '@/lib/companySettings';
import { formatCompanyDate, formatCompanyMoney } from '@/lib/companyFormatters';
import { getTodayLocalDateString } from '../financials-date-utils';
import { summarizeReconciliation } from './bankReconciliationService';
import type { BankMatchCandidate, BankReconciliationFilters, BankReconciliationMatchValues, BankStatementImportValues, BankStatementLine, BankStatementLineFormValues } from './types';
import { useBankAccounts, useBankStatementLines, useCreateBankStatementLine, useIgnoreBankStatementLine, useImportBankStatementCsv, useMatchBankStatementLine, useSuggestedBankMatches } from './useBankReconciliation';

const statusLabels = { all: 'كل الحالات', unmatched: 'غير مطابقة', matched: 'مطابقة', ignored: 'متجاهلة' } as const;
const entityLabels = { payment: 'دفعة', receipt: 'إيصال', expense: 'مصروف', manual_adjustment: 'تسوية يدوية' } as const;

const emptyLineDraft: BankStatementLineFormValues = { bank_account_id: '', transaction_date: getTodayLocalDateString(), description: '', reference: '', amount: '' };
const emptyMatchDraft: BankReconciliationMatchValues = { statement_line_id: '', matched_entity_type: 'payment', matched_entity_id: '', matched_amount: '', notes: '' };
const emptyImportDraft: BankStatementImportValues = { bank_account_id: '', statement_name: '', csv: '' };

function formatDate(value: string | null | undefined) {
  return formatCompanyDate(defaultCompanyLocalSettings, value ? `${value}T00:00:00` : value);
}

export function BankReconciliationPage() {
  const [filters, setFilters] = useState<BankReconciliationFilters>({ bankAccountId: '', status: 'all', from: '', to: '' });
  const [lineDraft, setLineDraft] = useState<BankStatementLineFormValues>(emptyLineDraft);
  const [matchDraft, setMatchDraft] = useState<BankReconciliationMatchValues>(emptyMatchDraft);
  const [importDraft, setImportDraft] = useState<BankStatementImportValues>(emptyImportDraft);
  const accountsQuery = useBankAccounts();
  const linesQuery = useBankStatementLines(filters);
  const createLine = useCreateBankStatementLine();
  const importCsv = useImportBankStatementCsv();
  const matchLine = useMatchBankStatementLine();
  const ignoreLine = useIgnoreBankStatementLine();
  const { authorization } = useAuth();
  const lines = linesQuery.data ?? [];
  const summary = useMemo(() => summarizeReconciliation(lines), [lines]);
  const accounts = accountsQuery.data ?? [];
  const selectedLine = lines.find((line) => line.id === matchDraft.statement_line_id);
  const suggestionsQuery = useSuggestedBankMatches(selectedLine);
  const canManageReconciliation = canAccess(authorization, financialOperationPermissions.matchBankReconciliation);
  const writeError = createLine.error ?? importCsv.error ?? matchLine.error ?? ignoreLine.error;

  return (
    <PageLayout dir="rtl" size="wide">
      <PageHeader
        title="مطابقة البنك"
        description="أساس تشغيلي لمراجعة حركات كشف البنك ومطابقتها مع الدفعات أو الإيصالات أو المصروفات المسجلة. يدعم لصق CSV مبدئياً مع اقتراحات مطابقة حسب التاريخ والمبلغ."
        action={<Button disabled={!canManageReconciliation} title={canManageReconciliation ? undefined : 'ليس لديك صلاحية مطابقة البنك'} onClick={() => setLineDraft({ ...emptyLineDraft, bank_account_id: filters.bankAccountId || accounts[0]?.id || '' })}><Plus className="me-2 size-4" />تجهيز حركة يدوية</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <InlineStatCard label="إجمالي الحركات" value={String(summary.totalLines)} />
        <InlineStatCard label="غير مطابقة" value={String(summary.unmatchedCount)} />
        <InlineStatCard label="مطابقة" value={String(summary.matchedCount)} />
        <InlineStatCard label="صافي غير مطابق" value={formatCompanyMoney(defaultCompanyLocalSettings, summary.unmatchedAmount)} />
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <Select value={filters.bankAccountId} onChange={(event) => setFilters({ ...filters, bankAccountId: event.target.value })}>
            <option value="">كل الحسابات</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}
          </Select>
          <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as BankReconciliationFilters['status'] })}>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
          <Input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} aria-label="من تاريخ" />
          <Input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} aria-label="إلى تاريخ" />
        </CardContent>
      </Card>

      {writeError ? <WriteErrorCard message={writeError instanceof Error ? writeError.message : 'تعذر حفظ التغيير في مطابقة البنك.'} /> : null}
      {accountsQuery.isLoading || linesQuery.isLoading ? <PageStateCard title="جارٍ تحميل حركات البنك..." /> : null}
      {!accountsQuery.isLoading && accounts.length === 0 ? <PageStateCard title="لا توجد حسابات بنكية بعد" description="أضف حساباً بنكياً من قاعدة البيانات أو migration seed قبل تسجيل حركات كشف البنك." /> : null}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="size-5" />استيراد CSV لحركات كشف البنك</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => { event.preventDefault(); if (!canManageReconciliation) return; importCsv.mutate(importDraft, { onSuccess: () => setImportDraft(emptyImportDraft) }); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <Select required value={importDraft.bank_account_id} onChange={(event) => setImportDraft({ ...importDraft, bank_account_id: event.target.value })}><option value="">اختر الحساب</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}</Select>
              <Input value={importDraft.statement_name} onChange={(event) => setImportDraft({ ...importDraft, statement_name: event.target.value })} placeholder="اسم الكشف / الفترة" />
            </div>
            <Textarea value={importDraft.csv} onChange={(event) => setImportDraft({ ...importDraft, csv: event.target.value })} placeholder={'date,description,reference,amount\n2026-07-01,تحصيل إيجار,REC-100,250.00'} rows={5} />
            <div className="flex justify-end"><Button disabled={!canManageReconciliation || importCsv.isPending}>استيراد CSV</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="size-5" />إضافة حركة كشف يدوية</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5" onSubmit={(event) => { event.preventDefault(); if (!canManageReconciliation) return; createLine.mutate(lineDraft, { onSuccess: () => setLineDraft(emptyLineDraft) }); }}>
            <Select required value={lineDraft.bank_account_id} onChange={(event) => setLineDraft({ ...lineDraft, bank_account_id: event.target.value })}><option value="">اختر الحساب</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.account_name}</option>)}</Select>
            <Input required type="date" value={lineDraft.transaction_date} onChange={(event) => setLineDraft({ ...lineDraft, transaction_date: event.target.value })} />
            <Input value={lineDraft.description} onChange={(event) => setLineDraft({ ...lineDraft, description: event.target.value })} placeholder="الوصف" />
            <Input value={lineDraft.reference} onChange={(event) => setLineDraft({ ...lineDraft, reference: event.target.value })} placeholder="المرجع" />
            <div className="flex gap-2"><Input required type="number" step="0.01" value={lineDraft.amount} onChange={(event) => setLineDraft({ ...lineDraft, amount: event.target.value })} placeholder="المبلغ +/-" /><Button disabled={!canManageReconciliation || createLine.isPending}>حفظ</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="size-5" />مطابقة حركة</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-6" onSubmit={(event) => { event.preventDefault(); if (!canManageReconciliation) return; matchLine.mutate(matchDraft, { onSuccess: () => setMatchDraft(emptyMatchDraft) }); }}>
            <Select required value={matchDraft.statement_line_id} onChange={(event) => { const line = lines.find((item) => item.id === event.target.value); setMatchDraft({ ...matchDraft, statement_line_id: event.target.value, matched_amount: line?.amount.toString() ?? matchDraft.matched_amount }); }}><option value="">اختر حركة غير مطابقة</option>{lines.filter((line) => line.status === 'unmatched').map((line) => <option key={line.id} value={line.id}>{formatDate(line.transaction_date)} — {line.description} — {formatCompanyMoney(defaultCompanyLocalSettings, line.amount)}</option>)}</Select>
            <Select value={matchDraft.matched_entity_type} onChange={(event) => setMatchDraft({ ...matchDraft, matched_entity_type: event.target.value as BankReconciliationMatchValues['matched_entity_type'] })}>{Object.entries(entityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
            <Input required value={matchDraft.matched_entity_id} onChange={(event) => setMatchDraft({ ...matchDraft, matched_entity_id: event.target.value })} placeholder="معرف السجل" />
            <Input required type="number" step="0.01" value={matchDraft.matched_amount} onChange={(event) => setMatchDraft({ ...matchDraft, matched_amount: event.target.value })} placeholder="مبلغ المطابقة" />
            <Input value={matchDraft.notes} onChange={(event) => setMatchDraft({ ...matchDraft, notes: event.target.value })} placeholder="ملاحظات" />
            <Button disabled={!canManageReconciliation || matchLine.isPending || !selectedLine}><ShieldCheck className="me-2 size-4" />مطابقة</Button>
          </form>
          {selectedLine ? <SuggestedMatches candidates={suggestionsQuery.data ?? []} isLoading={suggestionsQuery.isLoading} isInteractive={canManageReconciliation} onUse={(candidate) => setMatchDraft({ ...matchDraft, matched_entity_type: candidate.entity_type, matched_entity_id: candidate.entity_id, matched_amount: candidate.amount.toString() })} /> : <p className="mt-3 text-sm text-muted-foreground">اختر حركة غير مطابقة لعرض اقتراحات المطابقة حسب التاريخ والمبلغ.</p>}
        </CardContent>
      </Card>

      {lines.length === 0 && !linesQuery.isLoading ? <PageStateCard title="لا توجد حركات كشف ضمن الفلاتر" description="أضف حركة يدوية أو غيّر الفلاتر لبدء المطابقة." /> : <BankStatementLinesTable lines={lines} onIgnore={(id) => { if (canManageReconciliation) ignoreLine.mutate(id); }} isIgnoring={!canManageReconciliation || ignoreLine.isPending} />}
    </PageLayout>
  );
}

function statusTone(status: BankStatementLine['status']): 'green' | 'gray' | 'gold' {
  if (status === 'matched') return 'green';
  if (status === 'ignored') return 'gray';
  return 'gold';
}

function BankStatementLinesTable({ lines, onIgnore, isIgnoring }: Readonly<{ lines: BankStatementLine[]; onIgnore: (id: string) => void; isIgnoring: boolean }>) {
  const columns: ColumnDef<BankStatementLine>[] = [
    { key: 'date', header: 'التاريخ', render: (line) => formatDate(line.transaction_date) },
    { key: 'description', header: 'الوصف', render: (line) => <span className="font-bold">{line.description}</span> },
    { key: 'reference', header: 'المرجع', render: (line) => line.reference ?? '—' },
    { key: 'amount', header: 'المبلغ', render: (line) => formatCompanyMoney(defaultCompanyLocalSettings, line.amount) },
    { key: 'status', header: 'الحالة', render: (line) => <StatusBadge tone={statusTone(line.status)}>{statusLabels[line.status]}</StatusBadge> },
    {
      key: 'action',
      header: 'إجراء',
      render: (line) =>
        line.status === 'unmatched' ? (
          <Button variant="secondary" className="min-h-8 px-3 text-xs" disabled={isIgnoring} onClick={() => onIgnore(line.id)}>
            تجاهل
          </Button>
        ) : (
          '—'
        ),
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
        <div className="rounded-2xl border bg-background p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold leading-tight">{line.description}</p>
            <StatusBadge tone={statusTone(line.status)}>{statusLabels[line.status]}</StatusBadge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">التاريخ</p>
              <p className="font-medium">{formatDate(line.transaction_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">المرجع</p>
              <p className="font-medium">{line.reference ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">المبلغ</p>
              <p className="font-black">{formatCompanyMoney(defaultCompanyLocalSettings, line.amount)}</p>
            </div>
          </div>
          {line.status === 'unmatched' && (
            <div className="pt-1">
              <Button
                variant="secondary"
                className="min-h-8 w-full px-3 text-xs"
                disabled={isIgnoring}
                onClick={() => onIgnore(line.id)}
              >
                تجاهل
              </Button>
            </div>
          )}
        </div>
      )}
    />
  );
}


function SuggestedMatches({ candidates, isLoading, isInteractive, onUse }: Readonly<{ candidates: BankMatchCandidate[]; isLoading: boolean; isInteractive: boolean; onUse: (candidate: BankMatchCandidate) => void }>) {
  if (isLoading) return <p className="mt-3 text-sm text-muted-foreground">جارٍ تحميل الاقتراحات...</p>;
  if (candidates.length === 0) return <p className="mt-3 text-sm text-muted-foreground">لا توجد اقتراحات تلقائية للحركة المختارة بنفس التاريخ والمبلغ.</p>;
  return <div className="mt-4 grid gap-2"><p className="text-sm font-bold">اقتراحات مطابقة محتملة</p>{candidates.map((candidate) => <button key={`${candidate.entity_type}:${candidate.entity_id}`} type="button" className="rounded-xl border p-3 text-right text-sm hover:border-primary" disabled={!isInteractive} onClick={() => onUse(candidate)}><span className="font-bold">{entityLabels[candidate.entity_type]}</span><span className="mx-2">—</span><span>{candidate.label}</span><span className="mx-2">—</span><span>{formatCompanyMoney(defaultCompanyLocalSettings, candidate.amount)}</span></button>)}</div>;
}
