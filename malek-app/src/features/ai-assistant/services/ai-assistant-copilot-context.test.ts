import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contextual copilot wiring — verifies that buildAiAssistantContext loads the
 * v3 context (names, due-today, maintenance, vacancy, property performance,
 * deposits) and the scoped entity snapshot from authoritative rows only.
 *
 * The fake Supabase builder applies eq/in/is/lte/gte/not filters for real, so
 * scoping assertions (e.g. "property A never sees property B's arrears") test
 * genuine query behaviour instead of mock wiring.
 */

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => {
  const tables: Record<string, Row[] | null> = {};
  return { tables };
});

function parseNotInList(value: unknown): string[] {
  return String(value).replace(/[()]/g, '').split(',').map((entry) => entry.trim());
}

function fakeTable(rows: Row[] | null) {
  const filters: Array<(row: Row) => boolean> = [];
  let limitCount: number | null = null;

  function result(): Row[] {
    let out = (rows ?? []).filter((row) => filters.every((filter) => filter(row)));
    if (limitCount !== null) out = out.slice(0, limitCount);
    return out;
  }
  function resolved() {
    if (rows === null) return { data: null, error: { message: 'permission denied' } };
    return { data: result(), error: null };
  }

  const chain: Record<string, unknown> = {
    select: () => chain,
    is: (column: string, value: unknown) => {
      filters.push((row) => (row[column] ?? null) === value);
      return chain;
    },
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return chain;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return chain;
    },
    lte: (column: string, value: unknown) => {
      filters.push((row) => String(row[column]) <= String(value));
      return chain;
    },
    gte: (column: string, value: unknown) => {
      filters.push((row) => String(row[column]) >= String(value));
      return chain;
    },
    not: (column: string, _operator: string, value: unknown) => {
      const excluded = parseNotInList(value);
      filters.push((row) => !excluded.includes(String(row[column])));
      return chain;
    },
    order: () => chain,
    limit: (count: number) => {
      limitCount = count;
      return chain;
    },
    returns: () => chain,
    range: async (from: number, to: number) => {
      if (rows === null) return { data: null, error: { message: 'permission denied' } };
      return { data: result().slice(from, to + 1), error: null };
    },
    then: (resolve: (value: unknown) => unknown) => resolve(resolved()),
  };
  return chain;
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) =>
      fakeTable(table in mocks.tables ? mocks.tables[table] : []),
  },
}));

function seedBaseTables() {
  for (const key of Object.keys(mocks.tables)) delete mocks.tables[key];
  Object.assign(mocks.tables, {
    invoices: [
      { id: 'inv-old', contract_id: 'c1', due_date: '2026-07-01', amount: 100, paid_amount: 0, status: 'OPEN', deleted_at: null },
      { id: 'inv-today', contract_id: 'c1', due_date: '2026-09-02', amount: 50, paid_amount: 0, status: 'UNPAID', deleted_at: null },
      { id: 'inv-p2', contract_id: 'c2', due_date: '2026-08-01', amount: 30, paid_amount: 0, status: 'OPEN', deleted_at: null },
      { id: 'inv-future', contract_id: 'c1', due_date: '2026-10-01', amount: 70, paid_amount: 0, status: 'OPEN', deleted_at: null },
      { id: 'inv-paid', contract_id: 'c2', due_date: '2026-06-01', amount: 10, paid_amount: 10, status: 'PAID', deleted_at: null },
    ],
    contracts: [
      {
        id: 'c1', property_id: 'p1', tenant_id: 't1', unit_id: 'u1', start_date: '2025-09-21', end_date: '2026-09-20',
        rent_amount: 200, status: 'active', deleted_at: null,
        people: { full_name: 'أحمد المعمري' }, properties: { title: 'برج صحار', name: null }, units: { name: 'A1', unit_number: '1' },
      },
      {
        id: 'c2', property_id: 'p2', tenant_id: 't2', unit_id: 'u3', start_date: '2026-05-01', end_date: '2027-05-01',
        rent_amount: 150, status: 'active', deleted_at: null,
        people: { full_name: 'سالم البلوشي' }, properties: { title: 'مجمع الباطنة', name: null }, units: { name: 'B1', unit_number: '3' },
      },
    ],
    properties: [
      { id: 'p1', title: 'برج صحار', name: null, status: 'active', deleted_at: null },
      { id: 'p2', title: 'مجمع الباطنة', name: null, status: 'active', deleted_at: null },
    ],
    units: [
      { id: 'u1', property_id: 'p1', status: 'occupied', name: 'A1', unit_number: '1', rent_amount: 200, deleted_at: null, properties: { title: 'برج صحار', name: null } },
      { id: 'u2', property_id: 'p1', status: 'available', name: 'A2', unit_number: '2', rent_amount: 120, deleted_at: null, properties: { title: 'برج صحار', name: null } },
      { id: 'u3', property_id: 'p2', status: 'occupied', name: 'B1', unit_number: '3', rent_amount: 150, deleted_at: null, properties: { title: 'مجمع الباطنة', name: null } },
    ],
    payments: [
      { id: 'pay-1', amount: 75, payment_date: '2026-08-20', status: 'POSTED', deleted_at: null },
    ],
    expenses: [
      { id: 'exp-1', amount: 20, expense_date: '2026-08-25', deleted_at: null },
    ],
    maintenance_records: [
      { id: 'm1', property_id: 'p1', title: 'تسريب مياه', priority: 'urgent', status: 'open', request_date: '2026-08-20', scheduled_date: null, created_at: '2026-08-20T09:00:00Z', deleted_at: null, properties: { title: 'برج صحار', name: null } },
      { id: 'm2', property_id: 'p2', title: 'صيانة مكيف', priority: 'medium', status: 'in_progress', request_date: '2026-08-30', scheduled_date: null, created_at: '2026-08-30T09:00:00Z', deleted_at: null, properties: { title: 'مجمع الباطنة', name: null } },
      { id: 'm3', property_id: 'p1', title: 'دهان ممر', priority: 'low', status: 'resolved', request_date: '2026-08-01', scheduled_date: null, created_at: '2026-08-01T09:00:00Z', deleted_at: null, properties: { title: 'برج صحار', name: null } },
      { id: 'm4', property_id: 'p1', title: 'مغلق قديم', priority: 'low', status: 'closed', request_date: '2026-07-01', scheduled_date: null, created_at: '2026-07-01T09:00:00Z', deleted_at: null, properties: { title: 'برج صحار', name: null } },
    ],
    tenant_deposits: [
      { id: 'd1', remaining_amount: 300, status: 'held', deleted_at: null },
      { id: 'd2', remaining_amount: 0, status: 'refunded', deleted_at: null },
    ],
    people: [
      { id: 't1', full_name: 'أحمد المعمري', deleted_at: null },
      { id: 't2', full_name: 'سالم البلوشي', deleted_at: null },
    ],
    owners: [
      { id: 'o1', full_name: 'خالد الشيزاوي', display_name: null, name: null, deleted_at: null },
    ],
    property_owners: [
      { id: 'po1', owner_id: 'o1', property_id: 'p1' },
      { id: 'po2', owner_id: 'o1', property_id: 'p2' },
    ],
  });
}

async function loadService() {
  return import('./ai-assistant-service');
}

function surfaceFor(entityType: 'property' | 'unit' | 'contract' | 'tenant' | 'owner' | 'person' | null, entityId: string | null, route = '/x') {
  return { route, entityType, entityId, entityLabel: null, section: null };
}

describe('contextual copilot service wiring', () => {
  beforeEach(() => {
    seedBaseTables();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:00'));
  });

  it('wires due-today, names, maintenance, vacancy, performance, and deposits from authoritative rows', async () => {
    const { buildAiAssistantContext } = await loadService();
    const context = await buildAiAssistantContext();

    // Overdue = due on/before today, still carrying a remaining amount.
    expect(context.overdueInvoices.invoiceCount).toBe(3);
    expect(context.overdueInvoices.totalOutstanding).toBe(180);
    expect(context.overdueInvoices.dueTodayCount).toBe(1);
    expect(context.overdueInvoices.dueTodayAmount).toBe(50);

    const top = context.overdueInvoices.topInvoices[0];
    expect(top).toMatchObject({
      invoiceId: 'inv-old',
      tenantName: 'أحمد المعمري',
      propertyName: 'برج صحار',
      daysOverdue: 63,
    });

    expect(context.maintenanceSnapshot).toMatchObject({
      openCount: 1,
      inProgressCount: 1,
      urgentOpenCount: 1,
      stalledCount: 1,
      awaitingClosureCount: 1,
      oldestOpenAgeDays: 13,
    });
    expect(context.maintenanceSnapshot?.topRequests[0]).toMatchObject({
      requestId: 'm1',
      propertyName: 'برج صحار',
      issue: 'تسريب مياه',
      priority: 'urgent',
      ageDays: 13,
    });
    // Closed work never appears in the operational snapshot.
    expect(JSON.stringify(context.maintenanceSnapshot)).not.toContain('m4');

    expect(context.vacancyDetail?.topVacantUnits).toEqual([
      { unitId: 'u2', propertyName: 'برج صحار', unitName: 'A2' },
    ]);

    expect(context.propertyPerformance?.topOutstanding[0]).toEqual({
      propertyId: 'p1',
      propertyName: 'برج صحار',
      outstandingAmount: 150,
      openInvoiceCount: 2,
    });
    expect(context.propertyPerformance?.topOutstanding[1]).toMatchObject({ propertyId: 'p2', outstandingAmount: 30 });

    expect(context.depositHeld).toEqual({ totalHeld: 300, heldCount: 1 });

    // The Edge Function enforces a strict serialized budget.
    expect(JSON.stringify(context).length).toBeLessThanOrEqual(9_000);
  });

  it('loads a scoped property entity without leaking other properties', async () => {
    const { buildAiAssistantContext } = await loadService();
    const context = await buildAiAssistantContext(surfaceFor('property', 'p1', '/properties/p1'));

    expect(context.surface).toMatchObject({ entityType: 'property', entityId: 'p1', entityLabel: 'برج صحار' });
    expect(context.entity).toMatchObject({
      type: 'property',
      id: 'p1',
      name: 'برج صحار',
      unitCount: 2,
      occupiedUnitCount: 1,
      activeContractCount: 1,
      monthlyRentAmount: 200,
      // Only p1's contracts (c1): 100 + 50 — never c2's 30.
      outstandingAmount: 150,
      oldestOverdueDate: '2026-07-01',
    });
  });

  it('loads unit, contract, tenant, and owner entities from authoritative rows', async () => {
    const { buildAiAssistantContext } = await loadService();

    const unit = (await buildAiAssistantContext(surfaceFor('unit', 'u2'))).entity;
    expect(unit).toMatchObject({ type: 'unit', name: 'A2', status: 'available', propertyName: 'برج صحار', outstandingAmount: 0 });

    const contract = (await buildAiAssistantContext(surfaceFor('contract', 'c1'))).entity;
    expect(contract).toMatchObject({
      type: 'contract',
      tenantName: 'أحمد المعمري',
      propertyName: 'برج صحار',
      rentAmount: 200,
      endDate: '2026-09-20',
      outstandingAmount: 150,
      nextDueDate: '2026-09-02',
    });

    const tenant = (await buildAiAssistantContext(surfaceFor('tenant', 't1'))).entity;
    expect(tenant).toMatchObject({ type: 'tenant', name: 'أحمد المعمري', activeContractCount: 1, outstandingAmount: 150 });

    const owner = (await buildAiAssistantContext(surfaceFor('owner', 'o1'))).entity;
    expect(owner).toMatchObject({ type: 'owner', name: 'خالد الشيزاوي', propertyCount: 2, activeContractCount: 2, outstandingAmount: 180 });
  });

  it('fails safe when the routed id does not resolve to an authoritative row', async () => {
    const { buildAiAssistantContext } = await loadService();
    const context = await buildAiAssistantContext(surfaceFor('property', 'does-not-exist', '/properties/does-not-exist'));

    expect(context.entity).toBeUndefined();
    expect(context.surface).toMatchObject({ entityType: null, entityId: null, entityLabel: null });
    // General context still works.
    expect(context.overdueInvoices.invoiceCount).toBe(3);
  });

  it('omits maintenance and deposit sections when their reads fail (unknown, never zero)', async () => {
    mocks.tables.maintenance_records = null;
    mocks.tables.tenant_deposits = null;
    const { buildAiAssistantContext } = await loadService();
    const context = await buildAiAssistantContext();

    expect(context.maintenanceSnapshot).toBeUndefined();
    expect(context.depositHeld).toBeUndefined();
    const serialized = JSON.parse(JSON.stringify(context)) as Record<string, unknown>;
    expect('maintenanceSnapshot' in serialized).toBe(false);
    expect('depositHeld' in serialized).toBe(false);
  });
});
