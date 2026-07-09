import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { handleSupabaseError } from '@/lib/supabase-error';
import type { Contract, Expense, Invoice, Payment, Property, Unit } from '@/types/domain';
import type {
  AiAssistantAction,
  AiAssistantContext,
  AiAssistantHistoryMessage,
  AiAssistantRequest,
  AiAssistantResponse,
} from '../types';
import { AiAssistantConfigurationError, looksLikeRawSqlPrompt } from './ai-assistant-guardrails';

export { AiAssistantConfigurationError, isAiAssistantConfigurationError, looksLikeRawSqlPrompt } from './ai-assistant-guardrails';

const sampleLimit = 500;
const topListLimit = 25;
const renewalLookaheadDays = 90;

type InvoiceContextRow = Pick<Invoice, 'id' | 'contract_id' | 'due_date' | 'amount' | 'paid_amount' | 'status' | 'deleted_at'>;
type ContractRenewalRow = Pick<Contract, 'id' | 'property_id' | 'tenant_id' | 'unit_id' | 'end_date' | 'rent_amount' | 'status' | 'deleted_at'>;
type PropertySnapshotRow = Pick<Property, 'id' | 'status' | 'deleted_at'>;
type UnitSnapshotRow = Pick<Unit, 'id' | 'status' | 'deleted_at'>;
type PaymentSnapshotRow = Pick<Payment, 'id' | 'amount' | 'payment_date' | 'status' | 'deleted_at'>;
type ExpenseSnapshotRow = Pick<Expense, 'id' | 'amount' | 'expense_date' | 'deleted_at'>;

type FunctionErrorBody = {
  error?: {
    code?: string;
    message?: string;
  };
};

type FunctionSuccessBody = {
  reply?: string;
};

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sum(values: number[]): number {
  return Number(values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0).toFixed(3));
}

function remainingAmount(invoice: Pick<InvoiceContextRow, 'amount' | 'paid_amount'>): number {
  return Math.max(0, Number(invoice.amount ?? 0) - Number(invoice.paid_amount ?? 0));
}

function isOpenInvoiceStatus(status: string | null | undefined): boolean {
  const normalized = status?.toLowerCase() ?? '';
  return !['paid', 'void', 'draft', 'cancelled', 'canceled'].includes(normalized);
}

function isActivePayment(payment: PaymentSnapshotRow): boolean {
  return !payment.deleted_at && payment.status?.toUpperCase() !== 'VOID';
}

async function fetchOverdueInvoices(asOf: string) {
  const { data, error } = await supabase
    .from('invoices')
    .select('id, contract_id, due_date, amount, paid_amount, status, deleted_at')
    .is('deleted_at', null)
    .lte('due_date', asOf)
    .order('due_date', { ascending: true })
    .limit(sampleLimit)
    .returns<InvoiceContextRow[]>();

  if (error) handleSupabaseError(error, 'تعذر تجهيز ملخص الفواتير المتأخرة');
  const rows = (data ?? [])
    .filter((invoice) => isOpenInvoiceStatus(invoice.status) && remainingAmount(invoice) > 0)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  return rows;
}

async function fetchContractRenewals(asOf: string, until: string) {
  const { data, error } = await supabase
    .from('contracts')
    .select('id, property_id, tenant_id, unit_id, end_date, rent_amount, status, deleted_at')
    .is('deleted_at', null)
    .eq('status', 'active')
    .gte('end_date', asOf)
    .lte('end_date', until)
    .order('end_date', { ascending: true })
    .limit(topListLimit)
    .returns<ContractRenewalRow[]>();

  if (error) handleSupabaseError(error, 'تعذر تجهيز ملخص العقود القريبة من التجديد');
  return data ?? [];
}

async function fetchSnapshotRows(asOf: string, thirtyDaysAgo: string, ninetyDaysAgo: string) {
  const [propertiesResult, unitsResult, invoicesResult, paymentsResult, expenses90Result, expenses30Result] = await Promise.all([
    supabase.from('properties').select('id, status, deleted_at').is('deleted_at', null).limit(sampleLimit).returns<PropertySnapshotRow[]>(),
    supabase.from('units').select('id, status, deleted_at').is('deleted_at', null).limit(sampleLimit).returns<UnitSnapshotRow[]>(),
    supabase.from('invoices').select('id, contract_id, due_date, amount, paid_amount, status, deleted_at').is('deleted_at', null).lte('due_date', asOf).limit(sampleLimit).returns<InvoiceContextRow[]>(),
    supabase.from('payments').select('id, amount, payment_date, status, deleted_at').is('deleted_at', null).gte('payment_date', thirtyDaysAgo).lte('payment_date', asOf).limit(sampleLimit).returns<PaymentSnapshotRow[]>(),
    supabase.from('expenses').select('id, amount, expense_date, deleted_at').is('deleted_at', null).gte('expense_date', ninetyDaysAgo).lte('expense_date', asOf).limit(sampleLimit).returns<ExpenseSnapshotRow[]>(),
    supabase.from('expenses').select('id, amount, expense_date, deleted_at').is('deleted_at', null).gte('expense_date', thirtyDaysAgo).lte('expense_date', asOf).limit(sampleLimit).returns<ExpenseSnapshotRow[]>(),
  ]);

  if (propertiesResult.error) handleSupabaseError(propertiesResult.error, 'تعذر تجهيز ملخص العقارات');
  if (unitsResult.error) handleSupabaseError(unitsResult.error, 'تعذر تجهيز ملخص الوحدات');
  if (invoicesResult.error) handleSupabaseError(invoicesResult.error, 'تعذر تجهيز ملخص الفواتير');
  if (paymentsResult.error) handleSupabaseError(paymentsResult.error, 'تعذر تجهيز ملخص التحصيلات');
  if (expenses90Result.error) handleSupabaseError(expenses90Result.error, 'تعذر تجهيز ملخص المصاريف');
  if (expenses30Result.error) handleSupabaseError(expenses30Result.error, 'تعذر تجهيز ملخص المصاريف');

  return {
    properties: propertiesResult.data ?? [],
    units: unitsResult.data ?? [],
    invoices: invoicesResult.data ?? [],
    payments: paymentsResult.data ?? [],
    expenses90: expenses90Result.data ?? [],
    expenses30: expenses30Result.data ?? [],
  };
}

export async function buildAiAssistantContext(): Promise<AiAssistantContext> {
  const now = new Date();
  const asOf = toDateOnly(now);
  const renewalUntil = toDateOnly(addDays(now, renewalLookaheadDays));
  const thirtyDaysAgo = toDateOnly(addDays(now, -30));
  const ninetyDaysAgo = toDateOnly(addDays(now, -90));

  const [overdueInvoices, contractRenewals, snapshot] = await Promise.all([
    fetchOverdueInvoices(asOf),
    fetchContractRenewals(asOf, renewalUntil),
    fetchSnapshotRows(asOf, thirtyDaysAgo, ninetyDaysAgo),
  ]);

  const openSnapshotInvoices = snapshot.invoices.filter((invoice) => isOpenInvoiceStatus(invoice.status) && remainingAmount(invoice) > 0);
  const activePayments = snapshot.payments.filter(isActivePayment);
  const invoiceAmountLast30Days = snapshot.invoices
    .filter((invoice) => invoice.due_date >= thirtyDaysAgo && isOpenInvoiceStatus(invoice.status))
    .map((invoice) => Number(invoice.amount ?? 0));
  const occupiedUnitCount = snapshot.units.filter((unit) => unit.status === 'occupied').length;
  const unitCount = snapshot.units.length;

  return {
    asOf,
    sampleLimit,
    overdueInvoices: {
      invoiceCount: overdueInvoices.length,
      totalOutstanding: sum(overdueInvoices.map(remainingAmount)),
      oldestDueDate: overdueInvoices[0]?.due_date ?? null,
      topInvoices: overdueInvoices.slice(0, topListLimit).map((invoice) => ({
        invoiceId: invoice.id,
        contractId: invoice.contract_id,
        dueDate: invoice.due_date,
        remainingAmount: remainingAmount(invoice),
        status: invoice.status,
      })),
    },
    contractRenewals: {
      lookaheadDays: renewalLookaheadDays,
      contractCount: contractRenewals.length,
      totalRentAmount: sum(contractRenewals.map((contract) => Number(contract.rent_amount ?? 0))),
      upcomingContracts: contractRenewals.map((contract) => ({
        contractId: contract.id,
        propertyId: contract.property_id,
        tenantId: contract.tenant_id,
        unitId: contract.unit_id,
        endDate: contract.end_date,
        rentAmount: Number(contract.rent_amount ?? 0),
      })),
    },
    propertyFinancialSnapshot: {
      propertyCount: snapshot.properties.length,
      activePropertyCount: snapshot.properties.filter((property) => property.status === 'active').length,
      unitCount,
      occupiedUnitCount,
      occupancyRate: unitCount > 0 ? Number(((occupiedUnitCount / unitCount) * 100).toFixed(2)) : 0,
      outstandingInvoiceAmount: sum(openSnapshotInvoices.map(remainingAmount)),
      expensesLast90Days: sum(snapshot.expenses90.map((expense) => Number(expense.amount ?? 0))),
    },
    reportSummary: {
      invoicesLast30Days: invoiceAmountLast30Days.length,
      invoiceAmountLast30Days: sum(invoiceAmountLast30Days),
      paymentsLast30Days: activePayments.length,
      paymentAmountLast30Days: sum(activePayments.map((payment) => Number(payment.amount ?? 0))),
      expensesLast30Days: snapshot.expenses30.length,
      expenseAmountLast30Days: sum(snapshot.expenses30.map((expense) => Number(expense.amount ?? 0))),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readErrorBody(value: unknown): FunctionErrorBody {
  if (!isRecord(value) || !isRecord(value.error)) return {};
  return {
    error: {
      code: typeof value.error.code === 'string' ? value.error.code : undefined,
      message: typeof value.error.message === 'string' ? value.error.message : undefined,
    },
  };
}

function readSuccessBody(value: unknown): FunctionSuccessBody {
  if (!isRecord(value)) return {};
  return { reply: typeof value.reply === 'string' ? value.reply : undefined };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) handleSupabaseError(error, 'تعذر قراءة جلسة المستخدم');
  const token = data.session?.access_token;
  if (!token) throw new Error('يجب تسجيل الدخول لاستخدام مساعد الذكاء الاصطناعي.');
  return token;
}

async function invokeAiAssistant(prompt: string, action: AiAssistantAction | undefined, history: AiAssistantHistoryMessage[], context: AiAssistantContext) {
  if (!env.isConfigured) throw new AiAssistantConfigurationError();

  const accessToken = await getAccessToken();
  const response = await fetch(`${env.supabaseUrl}/functions/v1/ai-assistant`, {
    method: 'POST',
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, action, history: history.slice(-6), context }),
  });

  const body = await readJson(response);
  if (!response.ok) {
    const errorBody = readErrorBody(body);
    const code = errorBody.error?.code;
    const message = errorBody.error?.message ?? 'تعذر تشغيل مساعد الذكاء الاصطناعي.';
    if (code === 'AI_CONFIG_MISSING') throw new AiAssistantConfigurationError(message);
    throw new Error(message);
  }

  const successBody = readSuccessBody(body);
  if (!successBody.reply?.trim()) throw new Error('عاد مساعد الذكاء الاصطناعي برد فارغ.');
  return successBody.reply.trim();
}

export async function requestAiAssistantResponse(request: AiAssistantRequest): Promise<AiAssistantResponse> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new Error('اكتب سؤالاً أو اختر إجراءً جاهزاً.');
  if (looksLikeRawSqlPrompt(prompt)) throw new Error('لا يقبل المساعد أوامر SQL ولا ينفذ استعلامات مباشرة. استخدم سؤالاً تشغيلياً بصيغة عادية.');

  const context = await buildAiAssistantContext();
  const reply = await invokeAiAssistant(prompt, request.action, request.history, context);
  return { reply, context };
}
