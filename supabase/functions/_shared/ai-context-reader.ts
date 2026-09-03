import { isStrictContextSection } from "./ai-safety.ts";
import type { ContextSection, JsonObject } from "./ai-contract.ts";

/**
 * Server-side context reads — the Edge Function fetches the narrow data
 * sections ITSELF through PostgREST, under the caller's own JWT (the same
 * RLS role the client queries under). This removes the need to ship a
 * pre-built snapshot for the sections it can read fresh.
 *
 * Governance notes:
 * - Query shapes mirror `rentrix-app/src/features/ai-assistant/services/
 *   ai-assistant-service.ts` exactly (tables, selects, filters, orders,
 *   limits, pagination, `.in()` chunking). Any divergence is a correctness
 *   bug — keep them in sync or add a test.
 * - `maintenanceSnapshot` is deliberately NOT server-read here: its rows
 *   need the maintenance feature's attention derivation (stalled /
 *   awaiting-closure / age rules), which stays owned by the maintenance
 *   workspace. It is served from the client-provided context as always.
 * - Failure policy: a failed base read makes its dependent section null
 *   ("unknown", never "zero"); the edge then falls back to the
 *   client-provided value for that section. One bad table can never poison
 *   the other sections.
 */

export const SERVER_CONTEXT_SECTIONS: readonly ContextSection[] = [
  "overdueInvoices",
  "contractRenewals",
  "propertyFinancialSnapshot",
  "reportSummary",
  "vacancyDetail",
  "propertyPerformance",
  "depositHeld",
] as const;

export type ServerContextSection = (typeof SERVER_CONTEXT_SECTIONS)[number];

export const SERVER_CONTEXT_SECTION_TIMEOUT_MS = 8_000;
/** Mirrors the client's paged reads: 1,000 rows × 20 pages, fail closed. */
const PAGE_SIZE = 1_000;
const MAX_PAGES = 20;
const SAMPLE_LIMIT = 500;
const IN_FILTER_BATCH_SIZE = 250;
const TOP_LIST_LIMIT = 25;
const TOP_INVOICE_PAYLOAD_LIMIT = 10;
const TOP_RENEWAL_PAYLOAD_LIMIT = 10;
const TOP_VACANT_UNIT_PAYLOAD_LIMIT = 6;
const TOP_PROPERTY_PERFORMANCE_PAYLOAD_LIMIT = 3;
const MAX_NAME_LENGTH = 60;
const RENEWAL_LOOKAHEAD_DAYS = 90;

const CLOSED_INVOICE_STATUSES = ["paid", "PAID", "void", "VOID", "draft", "DRAFT", "cancelled", "CANCELLED", "canceled", "CANCELED"];
const ACTIVE_CONTRACT_STATUSES = ["active", "ACTIVE"];

export type ContextReaderConfig = Readonly<{
  supabaseUrl: string;
  anonKey: string;
  /** The caller's verified access token — RLS applies under their role. */
  accessToken: string;
  timeoutMs?: number;
  /** Injectable clock (date-only semantics, same as the client). */
  now?: Date;
}>;

export type ContextReadResult = Readonly<{
  /** Successfully read sections, ready to replace the client's versions. */
  sections: Readonly<Partial<Record<ServerContextSection, JsonObject>>>;
  /** Requested sections whose server read failed (client fallback applies). */
  failures: readonly ServerContextSection[];
}>;

class ReadFailure extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReadFailure";
  }
}

// ---------------------------------------------------------------------------
// Pure derivation helpers — ported 1:1 from the client context builder.
// ---------------------------------------------------------------------------

function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function sum(values: readonly number[]): number {
  return Number(values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0).toFixed(3));
}

function remainingAmount(invoice: { amount: number | null; paid_amount: number | null }): number {
  return Math.max(0, Number(invoice.amount ?? 0) - Number(invoice.paid_amount ?? 0));
}

function isOpenInvoiceStatus(status: string | null | undefined): boolean {
  const normalized = status?.toLowerCase() ?? "";
  return !["paid", "void", "draft", "cancelled", "canceled"].includes(normalized);
}

function isActivePayment(payment: { status: string | null; deleted_at: string | null }): boolean {
  return !payment.deleted_at && payment.status?.toUpperCase() !== "VOID";
}

function boundedName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_NAME_LENGTH ? `${trimmed.slice(0, MAX_NAME_LENGTH - 1)}…` : trimmed;
}

type JoinedNameRecord =
  | { full_name?: string | null; title?: string | null; name?: string | null; unit_number?: string | null }
  | Array<{ full_name?: string | null; title?: string | null; name?: string | null; unit_number?: string | null }>
  | null
  | undefined;

function joinedName(record: JoinedNameRecord, ...fields: Array<"full_name" | "title" | "name" | "unit_number">): string | null {
  const entry = Array.isArray(record) ? record[0] : record;
  if (!entry) return null;
  for (const field of fields) {
    const name = boundedName(entry[field]);
    if (name) return name;
  }
  return null;
}

function daysBetweenDates(isoFrom: string, isoTo: string): number {
  const from = Date.parse(`${isoFrom}T00:00:00Z`);
  const to = Date.parse(`${isoTo}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

function chunkForInFilter(values: readonly string[]): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < values.length; index += IN_FILTER_BATCH_SIZE) {
    chunks.push(values.slice(index, index + IN_FILTER_BATCH_SIZE));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// PostgREST transport (user JWT + anon apikey → same RLS as the client).
// ---------------------------------------------------------------------------

export type QueryParam = readonly [key: string, value: string];

/** PostgREST GET with the user's RLS role. Repeated keys are supported
 * (PostgREST range filters compile to duplicated query params). */
async function restGet(config: ContextReaderConfig, path: string, params: readonly QueryParam[]): Promise<JsonObject[]> {
  const url = new URL(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`);
  for (const [key, value] of params) url.searchParams.append(key, value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? SERVER_CONTEXT_SECTION_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.accessToken}`,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new ReadFailure(`timeout reading ${path}`);
    throw new ReadFailure(`transport failure reading ${path}`);
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new ReadFailure(`http ${response.status} reading ${path}`);
  const body = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(body)) throw new ReadFailure(`unexpected body reading ${path}`);
  return body as JsonObject[];
}

/** Paged forward read mirroring the client's fetchAllRows (fail closed). */
async function restGetPaged(config: ContextReaderConfig, path: string, params: readonly QueryParam[]): Promise<JsonObject[]> {
  const rows: JsonObject[] = [];
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const from = pageIndex * PAGE_SIZE;
    const url = new URL(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${path}`);
    for (const [key, value] of params) url.searchParams.append(key, value);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? SERVER_CONTEXT_SECTION_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.accessToken}`,
          Range: `${from}-${from + PAGE_SIZE - 1}`,
        },
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw new ReadFailure(`timeout reading ${path}`);
      throw new ReadFailure(`transport failure reading ${path}`);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new ReadFailure(`http ${response.status} reading ${path}`);
    const body = (await response.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) throw new ReadFailure(`unexpected body reading ${path}`);
    const page = body as JsonObject[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  throw new ReadFailure(`pagination ceiling reached reading ${path}`);
}

// ---------------------------------------------------------------------------
// Row shapes (PostgREST responses for the selects below).
// ---------------------------------------------------------------------------

type InvoiceRow = {
  id: string;
  contract_id: string;
  due_date: string;
  amount: number | null;
  paid_amount: number | null;
  status: string | null;
  deleted_at: string | null;
};

type RenewalRow = {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  unit_id: string | null;
  end_date: string;
  rent_amount: number | null;
  status: string | null;
  deleted_at: string | null;
};

type ContractNameRow = {
  id: string;
  property_id: string | null;
  tenant_id: string | null;
  people?: JoinedNameRecord;
  properties?: JoinedNameRecord;
};

type PropertyRow = { id: string; status: string | null; deleted_at: string | null };
type UnitRow = {
  id: string;
  status: string | null;
  deleted_at: string | null;
  name?: string | null;
  unit_number?: string | null;
  property_id?: string | null;
  properties?: JoinedNameRecord;
};
type PaymentRow = { id: string; amount: number | null; payment_date: string; status: string | null; deleted_at: string | null };
type ExpenseRow = { id: string; amount: number | null; expense_date: string; deleted_at: string | null };
type DepositRow = { id: string; remaining_amount: number | null; status: string | null };

// ---------------------------------------------------------------------------
// Section derivation (same formulas as the client builder).
// ---------------------------------------------------------------------------

function buildOverdueSection(invoices: readonly InvoiceRow[], names: ReadonlyMap<string, ContractNameRow>, asOf: string): JsonObject {
  const overdueInvoices = invoices
    .filter((invoice) => remainingAmount(invoice) > 0)
    .sort((left, right) => left.due_date.localeCompare(right.due_date));
  const dueToday = overdueInvoices.filter((invoice) => invoice.due_date === asOf);
  return {
    invoiceCount: overdueInvoices.length,
    totalOutstanding: sum(overdueInvoices.map(remainingAmount)),
    oldestDueDate: overdueInvoices[0]?.due_date ?? null,
    topInvoices: overdueInvoices.slice(0, TOP_INVOICE_PAYLOAD_LIMIT).map((invoice) => {
      const contract = names.get(invoice.contract_id);
      return {
        invoiceId: invoice.id,
        contractId: invoice.contract_id,
        dueDate: invoice.due_date,
        remainingAmount: remainingAmount(invoice),
        status: invoice.status,
        tenantName: contract ? joinedName(contract.people, "full_name") : null,
        propertyName: contract ? joinedName(contract.properties, "title", "name") : null,
        daysOverdue: daysBetweenDates(invoice.due_date, asOf),
      };
    }),
    dueTodayCount: dueToday.length,
    dueTodayAmount: sum(dueToday.map(remainingAmount)),
  };
}

function buildRenewalsSection(renewals: readonly RenewalRow[]): JsonObject {
  return {
    lookaheadDays: RENEWAL_LOOKAHEAD_DAYS,
    contractCount: renewals.length,
    totalRentAmount: sum(renewals.map((contract) => Number(contract.rent_amount ?? 0))),
    upcomingContracts: renewals.slice(0, TOP_RENEWAL_PAYLOAD_LIMIT).map((contract) => ({
      contractId: contract.id,
      propertyId: contract.property_id,
      tenantId: contract.tenant_id,
      unitId: contract.unit_id,
      endDate: contract.end_date,
      rentAmount: Number(contract.rent_amount ?? 0),
    })),
  };
}

function buildSnapshotSection(
  properties: readonly PropertyRow[],
  units: readonly UnitRow[],
  invoices: readonly InvoiceRow[],
  expenses90: readonly ExpenseRow[],
): JsonObject {
  const unitCount = units.length;
  const occupiedUnitCount = units.filter((unit) => ["occupied", "rented"].includes(String(unit.status ?? "").trim().toLowerCase())).length;
  const vacantUnitCount = units.filter((unit) => String(unit.status ?? "").trim().toLowerCase() === "available").length;
  const overdue = invoices.filter((invoice) => remainingAmount(invoice) > 0);
  return {
    propertyCount: properties.length,
    activePropertyCount: properties.filter((property) => String(property.status ?? "").trim().toLowerCase() === "active").length,
    unitCount,
    occupiedUnitCount,
    vacantUnitCount,
    occupancyRate: unitCount > 0 ? Number(((occupiedUnitCount / unitCount) * 100).toFixed(2)) : 0,
    outstandingInvoiceAmount: sum(overdue.map(remainingAmount)),
    expensesLast90Days: sum(expenses90.map((expense) => Number(expense.amount ?? 0))),
  };
}

function buildReportSection(invoices: readonly InvoiceRow[], payments: readonly PaymentRow[], expenses90: readonly ExpenseRow[], thirtyDaysAgo: string): JsonObject {
  const invoiceAmounts = invoices
    .filter((invoice) => invoice.due_date >= thirtyDaysAgo)
    .map((invoice) => Number(invoice.amount ?? 0));
  const activePayments = payments.filter(isActivePayment);
  const expenses30 = expenses90.filter((expense) => expense.expense_date >= thirtyDaysAgo);
  return {
    invoicesLast30Days: invoiceAmounts.length,
    invoiceAmountLast30Days: sum(invoiceAmounts),
    paymentsLast30Days: activePayments.length,
    paymentAmountLast30Days: sum(activePayments.map((payment) => Number(payment.amount ?? 0))),
    expensesLast30Days: expenses30.length,
    expenseAmountLast30Days: sum(expenses30.map((expense) => Number(expense.amount ?? 0))),
  };
}

function buildVacancySection(units: readonly UnitRow[]): JsonObject {
  const vacantUnits = units.filter((unit) => String(unit.status ?? "").trim().toLowerCase() === "available");
  return {
    topVacantUnits: vacantUnits.slice(0, TOP_VACANT_UNIT_PAYLOAD_LIMIT).map((unit) => ({
      unitId: unit.id,
      propertyName: joinedName(unit.properties, "title", "name"),
      unitName: boundedName(unit.name) ?? boundedName(unit.unit_number),
    })),
  };
}

function buildPerformanceSection(invoices: readonly InvoiceRow[], names: ReadonlyMap<string, ContractNameRow>): JsonObject {
  const overdue = invoices.filter((invoice) => remainingAmount(invoice) > 0);
  const byProperty = new Map<string, { propertyName: string | null; outstandingAmount: number; openInvoiceCount: number }>();
  for (const invoice of overdue) {
    const contract = names.get(invoice.contract_id);
    if (!contract?.property_id) continue;
    const entry = byProperty.get(contract.property_id) ?? {
      propertyName: joinedName(contract.properties, "title", "name"),
      outstandingAmount: 0,
      openInvoiceCount: 0,
    };
    entry.outstandingAmount = Number((entry.outstandingAmount + remainingAmount(invoice)).toFixed(3));
    entry.openInvoiceCount += 1;
    byProperty.set(contract.property_id, entry);
  }
  const topOutstanding = [...byProperty.entries()]
    .map(([propertyId, entry]) => ({ propertyId, ...entry }))
    .sort((left, right) => right.outstandingAmount - left.outstandingAmount)
    .slice(0, TOP_PROPERTY_PERFORMANCE_PAYLOAD_LIMIT);
  return { topOutstanding };
}

function buildDepositsSection(deposits: readonly DepositRow[]): JsonObject {
  const held = deposits.filter((deposit) => Number(deposit.remaining_amount ?? 0) > 0);
  return {
    totalHeld: sum(held.map((deposit) => Number(deposit.remaining_amount ?? 0))),
    heldCount: held.length,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function readOrNull<T>(read: () => Promise<T>): Promise<T | null> {
  return read().catch(() => null);
}

/**
 * Fetches exactly the requested sections (subset of SERVER_CONTEXT_SECTIONS)
 * through the narrowest possible PostgREST reads: shared base rows are
 * fetched once per request and derived into every section that needs them.
 * Unknown/non-server sections are ignored.
 */
export async function readServerContextSections(
  requested: readonly string[],
  config: ContextReaderConfig,
): Promise<ContextReadResult> {
  const wanted = requested.filter((section): section is ServerContextSection =>
    (SERVER_CONTEXT_SECTIONS as readonly string[]).includes(section),
  );

  const now = config.now ?? new Date();
  const asOf = toDateOnly(now);
  const renewalUntil = toDateOnly(addDays(now, RENEWAL_LOOKAHEAD_DAYS));
  const thirtyDaysAgo = toDateOnly(addDays(now, -30));
  const ninetyDaysAgo = toDateOnly(addDays(now, -90));

  const hasAny = (sections: readonly ServerContextSection[]): boolean => sections.some((section) => wanted.includes(section));
  const needs = {
    invoices: hasAny(["overdueInvoices", "propertyFinancialSnapshot", "reportSummary", "propertyPerformance"]),
    nameMap: hasAny(["overdueInvoices", "propertyPerformance"]),
    renewals: wanted.includes("contractRenewals"),
    properties: wanted.includes("propertyFinancialSnapshot"),
    units: hasAny(["propertyFinancialSnapshot", "vacancyDetail"]),
    payments: wanted.includes("reportSummary"),
    expenses: hasAny(["propertyFinancialSnapshot", "reportSummary"]),
    deposits: wanted.includes("depositHeld"),
  };

  const closedInvoiceFilter = `not.in.(${CLOSED_INVOICE_STATUSES.join(",")})`;
  const [invoices, renewals, properties, units, payments, expenses90, deposits] = await Promise.all([
    needs.invoices
      ? readOrNull(() => restGetPaged(config, "invoices", [
          ["select", "id,contract_id,due_date,amount,paid_amount,status,deleted_at"],
          ["deleted_at", "is.null"],
          ["due_date", `lte.${asOf}`],
          ["status", closedInvoiceFilter],
          ["order", "due_date.asc"],
        ]))
      : Promise.resolve(null),
    needs.renewals
      ? readOrNull(() => restGet(config, "contracts", [
          ["select", "id,property_id,tenant_id,unit_id,end_date,rent_amount,status,deleted_at"],
          ["deleted_at", "is.null"],
          ["status", `in.(${ACTIVE_CONTRACT_STATUSES.join(",")})`],
          ["end_date", `gte.${asOf}`],
          ["end_date", `lte.${renewalUntil}`],
          ["order", "end_date.asc"],
          ["limit", String(TOP_LIST_LIMIT)],
        ]))
      : Promise.resolve(null),
    needs.properties
      ? readOrNull(() => restGetPaged(config, "properties", [
          ["select", "id,status,deleted_at"],
          ["deleted_at", "is.null"],
        ]))
      : Promise.resolve(null),
    needs.units
      ? readOrNull(() => restGetPaged(config, "units", [
          ["select", "id,status,deleted_at,name,unit_number,property_id,properties:property_id(title,name)"],
          ["deleted_at", "is.null"],
        ]))
      : Promise.resolve(null),
    needs.payments
      ? readOrNull(() => restGetPaged(config, "payments", [
          ["select", "id,amount,payment_date,status,deleted_at"],
          ["deleted_at", "is.null"],
          ["payment_date", `gte.${thirtyDaysAgo}`],
          ["payment_date", `lte.${asOf}`],
        ]))
      : Promise.resolve(null),
    needs.expenses
      ? readOrNull(() => restGetPaged(config, "expenses", [
          ["select", "id,amount,expense_date,deleted_at"],
          ["deleted_at", "is.null"],
          ["expense_date", `gte.${ninetyDaysAgo}`],
          ["expense_date", `lte.${asOf}`],
        ]))
      : Promise.resolve(null),
    needs.deposits
      ? readOrNull(() => restGet(config, "tenant_deposits", [
          ["select", "id,remaining_amount,status"],
          ["deleted_at", "is.null"],
          ["limit", String(SAMPLE_LIMIT)],
        ]))
      : Promise.resolve(null),
  ]);

  // Same defense-in-depth as the client: the DB filter is necessary but the
  // in-memory status re-check is part of the read contract.
  const openInvoices = invoices === null ? null : (invoices.filter((row) => isOpenInvoiceStatus(String(row.status))) as unknown as InvoiceRow[]);

  // Row shapes are guaranteed by the selects above; the arrays were validated
  // at the transport boundary.
  const renewalRows = renewals === null ? null : (renewals as unknown as RenewalRow[]);
  const propertyRows = properties === null ? null : (properties as unknown as PropertyRow[]);
  const unitRows = units === null ? null : (units as unknown as UnitRow[]);
  const paymentRows = payments === null ? null : (payments as unknown as PaymentRow[]);
  const expenseRows = expenses90 === null ? null : (expenses90 as unknown as ExpenseRow[]);
  const depositRows = deposits === null ? null : (deposits as unknown as DepositRow[]);

  let names: ReadonlyMap<string, ContractNameRow> = new Map();
  if (needs.nameMap && openInvoices) {
    // Same as the client: name lookups only for the genuinely outstanding
    // invoices (not every open one).
    const ids = [...new Set(openInvoices.filter((invoice) => remainingAmount(invoice) > 0).map((invoice) => String(invoice.contract_id)))]
      .filter((id) => id.length > 0)
      .slice(0, SAMPLE_LIMIT);
    if (ids.length > 0) {
      const collected: ContractNameRow[] = [];
      let nameMapOk = true;
      for (const chunk of chunkForInFilter(ids)) {
        const rows = await readOrNull(() => restGet(config, "contracts", [
          ["select", "id,property_id,tenant_id,people:people!contracts_tenant_id_fkey(full_name),properties:properties!contracts_property_id_fkey(title,name)"],
          ["id", `in.(${chunk.join(",")})`],
        ]));
        if (!rows) {
          nameMapOk = false;
          break;
        }
        collected.push(...(rows as unknown as ContractNameRow[]));
      }
      if (nameMapOk) {
        const map = new Map<string, ContractNameRow>();
        for (const row of collected) if (row && typeof row.id === "string") map.set(row.id, row);
        names = map;
      }
    }
  }

  const sections: Partial<Record<ServerContextSection, JsonObject>> = {};
  const failures: ServerContextSection[] = [];
  const emit = (section: ServerContextSection, value: JsonObject | null) => {
    // Fail closed on contract drift: an invalid shape degrades to the
    // client-provided value instead of reaching the model.
    if (value === null || !isStrictContextSection(section, value)) failures.push(section);
    else sections[section] = value;
  };

  for (const section of wanted) {
    switch (section) {
      case "overdueInvoices":
        emit(section, openInvoices ? buildOverdueSection(openInvoices, names, asOf) : null);
        break;
      case "contractRenewals":
        emit(section, renewalRows ? buildRenewalsSection(renewalRows) : null);
        break;
      case "propertyFinancialSnapshot":
        emit(
          section,
          propertyRows && unitRows && openInvoices && expenseRows
            ? buildSnapshotSection(propertyRows, unitRows, openInvoices, expenseRows)
            : null,
        );
        break;
      case "reportSummary":
        emit(section, paymentRows && expenseRows && openInvoices ? buildReportSection(openInvoices, paymentRows, expenseRows, thirtyDaysAgo) : null);
        break;
      case "vacancyDetail":
        emit(section, unitRows ? buildVacancySection(unitRows) : null);
        break;
      case "propertyPerformance":
        // Without the name map we cannot attribute outstanding to properties —
        // fail the section instead of asserting an empty top list.
        emit(section, openInvoices && names.size > 0 ? buildPerformanceSection(openInvoices, names) : null);
        break;
      case "depositHeld":
        emit(section, depositRows ? buildDepositsSection(depositRows) : null);
        break;
    }
  }

  return { sections, failures };
}

/**
 * Overlays server-read sections onto the client context. Only sections the
 * server successfully read are replaced; everything else (including
 * maintenanceSnapshot, which the server never reads) keeps the client value.
 */
export function mergeServerContextSections(
  clientContext: JsonObject,
  serverSections: Readonly<Partial<Record<ServerContextSection, JsonObject>>>,
): JsonObject {
  const merged: Record<string, unknown> = { ...clientContext };
  for (const [key, value] of Object.entries(serverSections)) {
    if (value && typeof value === "object" && !Array.isArray(value)) merged[key] = value;
  }
  return merged;
}
