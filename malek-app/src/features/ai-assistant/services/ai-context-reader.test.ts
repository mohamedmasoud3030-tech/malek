import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergeServerContextSections,
  readServerContextSections,
  SERVER_CONTEXT_SECTIONS,
} from "../../../../../supabase/functions/_shared/ai-context-reader";
import { isStrictContextSection } from "../../../../../supabase/functions/_shared/ai-safety";

const NOW = new Date(2026, 8, 4, 12, 0, 0); // 2026-09-04 12:00 local
const CONFIG = {
  supabaseUrl: "https://sb.example.com",
  anonKey: "anon-key-456",
  accessToken: "user-jwt-123",
  now: NOW,
};

/** asOf 2026-09-04 → renewal until 2026-12-03, 30d back 2026-08-05, 90d back 2026-06-06. */

type FetchCall = { url: URL; init: RequestInit | undefined };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

/** Route table: pathname → rows | Error | (url) => rows. */
type TableHandler = unknown[] | Error | ((url: URL) => unknown[]);
type TableMap = Record<string, TableHandler | undefined>;

function createFetchMock(tables: TableMap) {
  const calls: FetchCall[] = [];
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    calls.push({ url, init });
    const segments = url.pathname.split("/");
    const table = segments[segments.length - 1] ?? "";
    const handler = tables[table];
    if (handler === undefined) return jsonResponse([]);
    if (handler instanceof Error) throw handler;
    const body = typeof handler === "function" ? handler(url) : handler;
    return jsonResponse(body);
  });
  return { mock, calls };
}

const invoiceRows = [
  { id: "inv1", contract_id: "c1", due_date: "2026-09-04", amount: 100, paid_amount: 40, status: "UNPAID", deleted_at: null },
  { id: "inv2", contract_id: "c2", due_date: "2026-08-20", amount: 50, paid_amount: 0, status: "UNPAID", deleted_at: null },
  { id: "inv3", contract_id: "c1", due_date: "2026-08-05", amount: 30, paid_amount: 30, status: "UNPAID", deleted_at: null },
  { id: "inv4", contract_id: "c3", due_date: "2026-07-01", amount: 200, paid_amount: 20, status: "UNPAID", deleted_at: null },
  // DB filter should already exclude paid rows; the in-memory re-filter must
  // still catch one that slips through (client parity).
  { id: "inv5", contract_id: "c1", due_date: "2026-09-01", amount: 10, paid_amount: 0, status: "PAID", deleted_at: null },
];

const renewalRows = [
  { id: "r1", property_id: "p1", tenant_id: "t1", unit_id: "u1", end_date: "2026-09-30", rent_amount: 400, status: "ACTIVE", deleted_at: null },
  { id: "r2", property_id: "p2", tenant_id: "t2", unit_id: "u2", end_date: "2026-12-01", rent_amount: 350, status: "active", deleted_at: null },
];

const contractNameRows = [
  { id: "c1", property_id: "p1", tenant_id: "t1", people: [{ full_name: "أحمد سعيد" }], properties: [{ title: "برج نزوى", name: "برج نزوى" }] },
  { id: "c2", property_id: "p2", tenant_id: "t2", people: [{ full_name: "سارة" }], properties: [{ title: "عمارة صحم", name: null }] },
  { id: "c3", property_id: null, tenant_id: "t3", people: null, properties: null },
];

const propertyRows = [
  { id: "p1", status: "active", deleted_at: null },
  { id: "p2", status: "active", deleted_at: null },
  { id: "p3", status: "inactive", deleted_at: null },
];

const unitRows = [
  { id: "u1", status: "occupied", deleted_at: null, name: "101", unit_number: null, property_id: "p1", properties: [{ title: "برج نزوى", name: null }] },
  { id: "u2", status: "Rented", deleted_at: null, name: "202", unit_number: null, property_id: "p2", properties: [{ title: "عمارة صحم", name: null }] },
  { id: "u3", status: "Available", deleted_at: null, name: "303", unit_number: null, property_id: "p1", properties: [{ title: "برج نزوى", name: null }] },
  { id: "u4", status: "available", deleted_at: null, name: null, unit_number: "404", property_id: "p2", properties: null },
];

const paymentRows = [
  { id: "pay1", amount: 100, payment_date: "2026-09-01", status: "settled", deleted_at: null },
  { id: "pay2", amount: 50, payment_date: "2026-08-28", status: "VOID", deleted_at: null },
  { id: "pay3", amount: 25, payment_date: "2026-08-06", status: "settled", deleted_at: null },
];

const expenseRows = [
  { id: "e1", amount: 10, expense_date: "2026-09-02", deleted_at: null },
  { id: "e2", amount: 20, expense_date: "2026-07-15", deleted_at: null },
  { id: "e3", amount: 5, expense_date: "2026-08-20", deleted_at: null },
  { id: "e4", amount: 8, expense_date: "2026-06-20", deleted_at: null },
];

const depositRows = [
  { id: "d1", remaining_amount: 300, status: "active" },
  { id: "d2", remaining_amount: 0, status: "active" },
  { id: "d3", remaining_amount: 150, status: "active" },
];

const allTables: TableMap = {
  invoices: invoiceRows,
  // Two consumers share the contracts table: renewals (no id param) and the
  // name map (id=in.(...)).
  contracts: (url: URL) => (url.searchParams.has("id") ? contractNameRows : renewalRows),
  properties: propertyRows,
  units: unitRows,
  payments: paymentRows,
  expenses: expenseRows,
  tenant_deposits: depositRows,
};

function tablesFor(tables: TableMap) {
  return { ...allTables, ...tables };
}

describe("server-side context reader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never server-reads maintenanceSnapshot (maintenance-feature derivation stays client-owned)", () => {
    expect(SERVER_CONTEXT_SECTIONS).not.toContain("maintenanceSnapshot");
    vi.stubGlobal("fetch", createFetchMock(allTables).mock);
    return readServerContextSections(["maintenanceSnapshot", "depositHeld"], CONFIG).then((result) => {
      expect(result.sections).not.toHaveProperty("maintenanceSnapshot");
      expect(result.failures).not.toContain("maintenanceSnapshot");
      expect(result.sections.depositHeld).toEqual({ totalHeld: 450, heldCount: 2 });
    });
  });

  it("reads only the tables the requested sections need (narrow reads)", async () => {
    const { mock, calls } = createFetchMock(allTables);
    vi.stubGlobal("fetch", mock);
    await readServerContextSections(["reportSummary"], CONFIG);
    const tables = [...new Set(calls.map((call) => call.url.pathname.split("/").pop()))];
    expect(tables.sort()).toEqual(["expenses", "invoices", "payments"]);
  });

  it("mirrors the client's PostgREST query shapes, RLS headers and pagination", async () => {
    const { mock, calls } = createFetchMock(allTables);
    vi.stubGlobal("fetch", mock);
    await readServerContextSections([...SERVER_CONTEXT_SECTIONS], CONFIG);

    const byTable = (table: string, predicate?: (url: URL) => boolean) =>
      calls.filter((call) => call.url.pathname.endsWith(`/${table}`) && (predicate ? predicate(call.url) : true));

    const invoicesCall = byTable("invoices")[0];
    expect(invoicesCall).toBeDefined();
    const inv = invoicesCall.url;
    expect(inv.searchParams.get("select")).toBe("id,contract_id,due_date,amount,paid_amount,status,deleted_at");
    expect(inv.searchParams.get("deleted_at")).toBe("is.null");
    expect(inv.searchParams.get("due_date")).toBe("lte.2026-09-04");
    expect(inv.searchParams.get("status")).toBe("not.in.(paid,PAID,void,VOID,draft,DRAFT,cancelled,CANCELLED,canceled,CANCELED)");
    expect(inv.searchParams.get("order")).toBe("due_date.asc");
    const headers = invoicesCall.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer user-jwt-123");
    expect(headers.apikey).toBe("anon-key-456");
    expect(headers.Range).toBe("0-999");

    const renewalsCall = byTable("contracts", (url) => !url.searchParams.has("id"))[0];
    expect(renewalsCall).toBeDefined();
    const ren = renewalsCall.url;
    expect(ren.searchParams.get("status")).toBe("in.(active,ACTIVE)");
    expect(ren.searchParams.getAll("end_date")).toEqual(["gte.2026-09-04", "lte.2026-12-03"]);
    expect(ren.searchParams.get("order")).toBe("end_date.asc");
    expect(ren.searchParams.get("limit")).toBe("25");

    const nameMapCall = byTable("contracts", (url) => url.searchParams.has("id"))[0];
    expect(nameMapCall).toBeDefined();
    expect(nameMapCall.url.searchParams.getAll("id")[0]).toBe("in.(c1,c2,c3)");
    expect(nameMapCall.url.searchParams.get("select")).toBe(
      "id,property_id,tenant_id,people:people!contracts_tenant_id_fkey(full_name),properties:properties!contracts_property_id_fkey(title,name)",
    );

    const unitsCall = byTable("units")[0];
    expect(unitsCall.url.searchParams.get("select")).toBe("id,status,deleted_at,name,unit_number,property_id,properties:property_id(title,name)");
  });

  it("derives every section with the client's exact formulas", async () => {
    const { mock } = createFetchMock(allTables);
    vi.stubGlobal("fetch", mock);
    const result = await readServerContextSections([...SERVER_CONTEXT_SECTIONS], CONFIG);

    expect(result.failures).toEqual([]);
    expect(result.sections.overdueInvoices).toEqual({
      invoiceCount: 3,
      totalOutstanding: 290,
      oldestDueDate: "2026-07-01",
      topInvoices: [
        { invoiceId: "inv4", contractId: "c3", dueDate: "2026-07-01", remainingAmount: 180, status: "UNPAID", tenantName: null, propertyName: null, daysOverdue: 65 },
        { invoiceId: "inv2", contractId: "c2", dueDate: "2026-08-20", remainingAmount: 50, status: "UNPAID", tenantName: "سارة", propertyName: "عمارة صحم", daysOverdue: 15 },
        { invoiceId: "inv1", contractId: "c1", dueDate: "2026-09-04", remainingAmount: 60, status: "UNPAID", tenantName: "أحمد سعيد", propertyName: "برج نزوى", daysOverdue: 0 },
      ],
      dueTodayCount: 1,
      dueTodayAmount: 60,
    });
    expect(result.sections.contractRenewals).toEqual({
      lookaheadDays: 90,
      contractCount: 2,
      totalRentAmount: 750,
      upcomingContracts: [
        { contractId: "r1", propertyId: "p1", tenantId: "t1", unitId: "u1", endDate: "2026-09-30", rentAmount: 400 },
        { contractId: "r2", propertyId: "p2", tenantId: "t2", unitId: "u2", endDate: "2026-12-01", rentAmount: 350 },
      ],
    });
    expect(result.sections.propertyFinancialSnapshot).toEqual({
      propertyCount: 3,
      activePropertyCount: 2,
      unitCount: 4,
      occupiedUnitCount: 2,
      vacantUnitCount: 2,
      occupancyRate: 50,
      outstandingInvoiceAmount: 290,
      expensesLast90Days: 43,
    });
    expect(result.sections.reportSummary).toEqual({
      invoicesLast30Days: 3,
      invoiceAmountLast30Days: 180,
      paymentsLast30Days: 2,
      paymentAmountLast30Days: 125,
      expensesLast30Days: 2,
      expenseAmountLast30Days: 15,
    });
    expect(result.sections.vacancyDetail).toEqual({
      topVacantUnits: [
        { unitId: "u3", propertyName: "برج نزوى", unitName: "303" },
        { unitId: "u4", propertyName: null, unitName: "404" },
      ],
    });
    expect(result.sections.propertyPerformance).toEqual({
      topOutstanding: [
        { propertyId: "p1", propertyName: "برج نزوى", outstandingAmount: 60, openInvoiceCount: 1 },
        { propertyId: "p2", propertyName: "عمارة صحم", outstandingAmount: 50, openInvoiceCount: 1 },
      ],
    });
    expect(result.sections.depositHeld).toEqual({ totalHeld: 450, heldCount: 2 });
  });

  it("isolates failures: one broken table fails only its dependent sections", async () => {
    const { mock } = createFetchMock(
      tablesFor({ properties: new Error("properties boom") }),
    );
    vi.stubGlobal("fetch", mock);
    const result = await readServerContextSections([...SERVER_CONTEXT_SECTIONS], CONFIG);
    expect(result.failures).toEqual(["propertyFinancialSnapshot"]);
    expect(result.sections.overdueInvoices).toBeDefined();
    expect(result.sections.reportSummary).toBeDefined();
    expect(result.sections.vacancyDetail).toBeDefined();
    expect(result.sections.depositHeld).toEqual({ totalHeld: 450, heldCount: 2 });
  });

  it("degrades names to null when the name map fails, and fails only the attribution section", async () => {
    const { mock } = createFetchMock(
      tablesFor({
        contracts: (url: URL) => {
          if (url.searchParams.has("id")) throw new Error("name map boom");
          return renewalRows;
        },
      }),
    );
    vi.stubGlobal("fetch", mock);
    const result = await readServerContextSections(["overdueInvoices", "propertyPerformance"], CONFIG);
    expect(result.failures).toEqual(["propertyPerformance"]);
    const overdue = result.sections.overdueInvoices as { topInvoices: Array<{ tenantName: string | null }> } | undefined;
    expect(overdue).toBeDefined();
    expect(overdue?.topInvoices.map((row) => row.tenantName)).toEqual([null, null, null]);
  });

  it("fails closed on timeout (never asserts zero)", async () => {
    const hang = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return;
          const onAbort = () => reject(new DOMException("aborted", "AbortError"));
          if (signal.aborted) return onAbort();
          signal.addEventListener("abort", onAbort, { once: true });
        }),
    );
    vi.stubGlobal("fetch", hang);
    const result = await readServerContextSections(["depositHeld"], { ...CONFIG, timeoutMs: 50 });
    expect(result.sections).toEqual({});
    expect(result.failures).toEqual(["depositHeld"]);
  });

  it("overlays server sections onto the client context without mutating or touching other sections", () => {
    const clientOverdue = { invoiceCount: 1, totalOutstanding: 1, oldestDueDate: "2026-09-01", topInvoices: [], dueTodayCount: 0, dueTodayAmount: 0 };
    const serverOverdue = { invoiceCount: 2, totalOutstanding: 9, oldestDueDate: "2026-08-30", topInvoices: [], dueTodayCount: 0, dueTodayAmount: 0 };
    const clientContext = {
      asOf: "2026-09-04",
      sampleLimit: 500,
      overdueInvoices: clientOverdue,
      maintenanceSnapshot: { openCount: 3, inProgressCount: 1, urgentOpenCount: 0, stalledCount: 0, awaitingClosureCount: 0, oldestOpenAgeDays: 2, topRequests: [] },
    };
    const merged = mergeServerContextSections(clientContext, { overdueInvoices: serverOverdue });
    expect(merged.overdueInvoices).toBe(serverOverdue);
    // maintenanceSnapshot is never a server section — the client value stands.
    expect(merged.maintenanceSnapshot).toBe(clientContext.maintenanceSnapshot);
    expect(clientContext.overdueInvoices).toBe(clientOverdue);
  });
});

describe("isStrictContextSection (server-read gate)", () => {
  it("accepts a well-formed section", () => {
    expect(
      isStrictContextSection("overdueInvoices", {
        invoiceCount: 1,
        totalOutstanding: 5,
        oldestDueDate: "2026-09-01",
        topInvoices: [
          { invoiceId: "i", contractId: "c", dueDate: "2026-09-01", remainingAmount: 5, status: "UNPAID", tenantName: null, propertyName: null, daysOverdue: 0 },
        ],
        dueTodayCount: 0,
        dueTodayAmount: 0,
      }),
    ).toBe(true);
  });

  it("rejects unknown keys, bad row shapes, and oversized strings", () => {
    const base = { invoiceCount: 1, totalOutstanding: 5, oldestDueDate: null, topInvoices: [], dueTodayCount: 0, dueTodayAmount: 0 };
    expect(isStrictContextSection("overdueInvoices", { ...base, rogueKey: 1 })).toBe(false);
    expect(isStrictContextSection("overdueInvoices", { ...base, topInvoices: [{ invoiceId: "i", rogue: 1 }] })).toBe(false);
    expect(isStrictContextSection("overdueInvoices", { ...base, oldestDueDate: "x".repeat(201) })).toBe(false);
    expect(isStrictContextSection("overdueInvoices", null)).toBe(false);
  });
});
