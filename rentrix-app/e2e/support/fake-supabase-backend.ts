import type { Page, Route } from '@playwright/test';

/**
 * Deterministic seeded data plane for the PR 3 document/print/PDF browser
 * acceptance suite.
 *
 * The acceptance tests drive the REAL production UI surfaces (routes, page
 * components, action handlers, `documentService`, engine, renderer, popup,
 * downloads). The only stubbed boundary is the Supabase HTTP API, which has
 * no live project in hermetic CI. Every row below is shaped to match the
 * repository migrations (`supabase/migrations/20250101000001_core_schema.sql`)
 * and the exact selects/normalizers in `src/`.
 */

export const IDS = {
  company: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  companySettings: '00000000-0000-4000-8000-000000000001',
  tenant: '11111111-1111-4111-8111-111111111111',
  property: '22222222-2222-4222-8222-222222222222',
  unit: '33333333-3333-4333-8333-333333333333',
  contract: '44444444-4444-4444-8444-444444444444',
  invoiceUnpaid: '55555555-5555-4555-8555-555555555501',
  invoicePaid: '55555555-5555-4555-8555-555555555502',
  invoiceOverdue: '55555555-5555-4555-8555-555555555503',
  payment: '66666666-6666-4666-8666-666666666601',
  receipt: '77777777-7777-4777-8777-777777777701',
  owner: '88888888-8888-4888-8888-888888888801',
  user: '99999999-9999-4999-8999-999999999901',
} as const;

/** The real company identity stored in `company_settings` for this suite. */
export const COMPANY_NAME = 'شركة الأفق لإدارة الأملاك';
export const COMPANY_TAX_NUMBER = 'OM1102345678';
/** The server-generated business reference carried by the seeded receipt. */
export const RECEIPT_REFERENCE = 'REC-2026-0001';
export const TENANT_NAME = 'أحمد بن سعيد الحارثي';
export const PROPERTY_TITLE = 'برج الواحة — صحار';
export const UNIT_NUMBER = '301';
export const OWNER_NAME = 'سالم بن راشد البلوشي';

/**
 * - `complete`: a real company identity row exists in `company_settings`.
 * - `settings-unavailable`: the settings read fails (500). This is the live,
 *   reachable state in which the document platform must block output: the
 *   canonical adapter never falls back to a brand default while the record
 *   is missing, so `isReady` stays false and actions stay disabled.
 */
export type CompanySettingsMode = 'complete' | 'settings-unavailable';

export type AcceptanceSeed = Readonly<{
  failCompanySettings: boolean;
  tables: Record<string, ReadonlyArray<Record<string, unknown>>>;
  rpcs: Record<string, (args: Record<string, unknown>) => unknown>;
}>;

const created = '2026-01-01T08:00:00.000Z';

function companySettingsRow(): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: IDS.companySettings,
    singleton_key: true,
    company_name: COMPANY_NAME,
    legal_name: 'شركة الأفق لإدارة الأملاك ش.م.م',
    tax_number: COMPANY_TAX_NUMBER,
    registration_number: 'CR-2026-4471',
    phone: '+968 2684 1000',
    email: 'office@ofoq-om.example',
    address: 'ولاية صحار، طريق السلطان قابوس، مبنى 12',
    city: 'صحار',
    country: 'OM',
    currency: 'OMR',
    locale: 'ar-OM',
    timezone: 'Asia/Muscat',
    date_format: 'dd/MM/yyyy',
    number_format: 'ar-OM',
    logo_url: null,
    invoice_prefix: 'INV',
    contract_prefix: 'CON',
    receipt_prefix: 'REC',
    default_vat_rate: 5,
    vat_enabled: true,
    vat_rate: 5,
    vat_registration_number: null,
    notification_email_enabled: true,
    notification_sms_enabled: false,
    created_at: created,
    updated_at: created,
  };
  return base;
}

function invoiceRow(id: string, status: string, paid: number, due: string, issue: string, notes: string): Record<string, unknown> {
  return {
    id,
    contract_id: IDS.contract,
    issue_date: issue,
    due_date: due,
    amount: '420.00',
    paid_amount: `${paid.toFixed(2)}`,
    tax_amount: '21.00',
    status,
    notes,
    created_at: created,
    updated_at: created,
    deleted_at: null,
    contracts: { id: IDS.contract, property_id: IDS.property, tenant_id: IDS.tenant },
  };
}

/** Long trial balance: 150 accounts, balanced totals — forces multi-page PDF output. */
function buildTrialBalancePayload(asOf: string): Record<string, unknown> {
  const accounts: Array<Record<string, unknown>> = [];
  let total = 0;
  for (let index = 1; index <= 75; index += 1) {
    const balance = Math.round((120 + index * 13.25) * 1000) / 1000;
    total += balance;
    accounts.push({
      code: `1${String(index).padStart(3, '0')}`,
      name: `حساب أصول تشغيلية رقم ${index} — فرع صحار`,
      type: 'asset',
      balance_type: 'debit',
      balance,
    });
  }
  for (let index = 1; index <= 75; index += 1) {
    const balance = Math.round((120 + index * 13.25) * 1000) / 1000;
    accounts.push({
      code: `2${String(index).padStart(3, '0')}`,
      name: `حساب التزامات وإيرادات رقم ${index} — فرع صحار`,
      type: index % 2 === 0 ? 'liability' : 'revenue',
      balance_type: 'credit',
      balance,
    });
  }
  const roundedTotal = Math.round(total * 1000) / 1000;
  return {
    as_of: asOf,
    accounts,
    total_debits: roundedTotal,
    total_credits: roundedTotal,
    is_balanced: true,
  };
}

/** Tenant statement with enough movement lines to span multiple A4 pages. */
function buildTenantStatementPayload(): Record<string, unknown> {
  const lines: Array<Record<string, unknown>> = [];
  let balance = 0;
  for (let month = 1; month <= 12; month += 1) {
    const monthLabel = String(month).padStart(2, '0');
    balance += 441;
    lines.push({
      date: `2026-${monthLabel}-01`,
      description: `مطالبة إيجار شهر ${monthLabel}/2026 — الوحدة ${UNIT_NUMBER}`,
      type: 'invoice',
      debit: 441,
      credit: 0,
      balance,
    });
    if (month <= 10) {
      balance -= 441;
      lines.push({
        date: `2026-${monthLabel}-10`,
        description: `سداد إيجار شهر ${monthLabel}/2026 نقدًا`,
        type: 'receipt',
        debit: 0,
        credit: 441,
        balance,
      });
    }
  }
  return {
    contract_id: IDS.contract,
    tenant_name: TENANT_NAME,
    tenant_phone: '+968 9123 4567',
    unit_name: UNIT_NUMBER,
    property_name: PROPERTY_TITLE,
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    lines,
    final_balance: balance,
    error: null,
  };
}

function buildOwnerStatementPayload(args: Record<string, unknown>): Record<string, unknown> {
  const transactions: Array<Record<string, unknown>> = [];
  let gross = 0;
  let deductions = 0;
  for (let month = 1; month <= 10; month += 1) {
    const monthLabel = String(month).padStart(2, '0');
    const rent = 840;
    const commission = Math.round(rent * 0.05 * 1000) / 1000;
    gross += rent;
    deductions += commission;
    transactions.push({
      date: `2026-${monthLabel}-12`,
      details: `تحصيل إيجار ${PROPERTY_TITLE} — الوحدة ${UNIT_NUMBER} عن شهر ${monthLabel}`,
      type: 'receipt',
      property_name: PROPERTY_TITLE,
      gross: rent,
      deduction: 0,
      net: rent,
    });
    transactions.push({
      date: `2026-${monthLabel}-13`,
      details: `عمولة الإدارة عن شهر ${monthLabel}`,
      type: 'settlement',
      property_name: PROPERTY_TITLE,
      gross: 0,
      deduction: commission,
      net: -commission,
    });
  }
  return {
    owner_name: OWNER_NAME,
    commission_type: 'percentage',
    commission_value: 5,
    transactions,
    total_gross: gross,
    total_deductions: Math.round(deductions * 1000) / 1000,
    total_net: Math.round((gross - deductions) * 1000) / 1000,
    period_from: typeof args.p_from === 'string' ? args.p_from : '2026-01-01',
    period_to: typeof args.p_to === 'string' ? args.p_to : '2026-12-31',
    error: null,
  };
}

export function buildAcceptanceSeed(mode: CompanySettingsMode): AcceptanceSeed {
  const contractRow: Record<string, unknown> = {
    id: IDS.contract,
    tenant_id: IDS.tenant,
    property_id: IDS.property,
    unit_id: IDS.unit,
    status: 'active',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    rent_amount: '420.00',
    payment_cycle: 'monthly',
    notes: 'عقد إيجار سنوي للسكن — سداد شهري.',
    created_at: created,
    updated_at: created,
    deleted_at: null,
    renewed_from_id: null,
    properties: { id: IDS.property, title: PROPERTY_TITLE, address: 'ولاية صحار، طريق السلطان قابوس' },
    units: { id: IDS.unit, unit_number: UNIT_NUMBER, floor: '3', status: 'occupied', rent_amount: '420.00' },
    people: { id: IDS.tenant, full_name: TENANT_NAME, phone: '+968 9123 4567', email: 'ahmed.harthi@example.om', national_id: 'OM99887766' },
    renewed_from: null,
  };

  const paymentRow: Record<string, unknown> = {
    id: IDS.payment,
    invoice_id: IDS.invoicePaid,
    amount: '441.00',
    payment_method: 'cash',
    payment_date: '2026-06-10',
    reference_number: 'PAY-REF-8801',
    reference_no: 'PAY-REF-8801',
    contract_id: IDS.contract,
    date_time: '2026-06-10T09:30:00.000Z',
    channel: 'office',
    status: 'POSTED',
    notes: null,
    receipt_id: IDS.receipt,
    created_by: IDS.user,
    created_at: created,
    updated_at: created,
    deleted_at: null,
  };

  const companyRow: Record<string, unknown> = {
    id: IDS.company,
    name: COMPANY_NAME,
    slug: 'ofoq-sohar',
    currency: 'OMR',
    locale: 'ar-OM',
    timezone: 'Asia/Muscat',
    is_active: true,
    created_at: created,
    updated_at: created,
  };

  const membershipRow: Record<string, unknown> = {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    company_id: IDS.company,
    user_id: IDS.user,
    role: 'OWNER',
    is_active: true,
    created_at: created,
    updated_at: created,
    companies: {
      id: IDS.company,
      name: COMPANY_NAME,
      slug: 'ofoq-sohar',
      currency: 'OMR',
      locale: 'ar-OM',
    },
  };

  const tables: Record<string, ReadonlyArray<Record<string, unknown>>> = {
    companies: [companyRow],
    company_members: [membershipRow],
    company_settings: [companySettingsRow()],
    people: [
      { id: IDS.tenant, full_name: TENANT_NAME, phone: '+968 9123 4567', email: 'ahmed.harthi@example.om', national_id: 'OM99887766', type: 'tenant', address: null, notes: null, created_at: created, updated_at: created, deleted_at: null },
    ],
    properties: [
      { id: IDS.property, title: PROPERTY_TITLE, address: 'ولاية صحار، طريق السلطان قابوس', type: 'residential', status: 'active', owner_name: OWNER_NAME, created_at: created, updated_at: created, deleted_at: null },
    ],
    units: [
      { id: IDS.unit, property_id: IDS.property, unit_number: UNIT_NUMBER, floor: '3', status: 'occupied', rent_amount: '420.00', created_at: created, updated_at: created, deleted_at: null },
    ],
    contracts: [contractRow],
    invoices: [
      invoiceRow(IDS.invoiceUnpaid, 'UNPAID', 0, '2026-07-15', '2026-07-01', 'إيجار شهر يوليو 2026'),
      invoiceRow(IDS.invoicePaid, 'PAID', 441, '2026-06-15', '2026-06-01', 'إيجار شهر يونيو 2026'),
      invoiceRow(IDS.invoiceOverdue, 'OVERDUE', 200, '2026-06-01', '2026-05-01', 'إيجار شهر مايو 2026'),
    ],
    payments: [paymentRow],
    receipts: [{ id: IDS.receipt, reference: RECEIPT_REFERENCE, contract_id: IDS.contract, amount: '441.00', status: 'POSTED' }],
    owners: [
      { id: IDS.owner, full_name: OWNER_NAME, name: OWNER_NAME, display_name: OWNER_NAME, phone: '+968 9988 7766', email: 'salem.balushi@example.om', is_active: true, created_at: created, updated_at: created, deleted_at: null },
    ],
  };

  const rpcs: Record<string, (args: Record<string, unknown>) => unknown> = {
    rpt_trial_balance: (args) => buildTrialBalancePayload(typeof args.p_as_of === 'string' ? args.p_as_of : '2026-08-06'),
    rpt_tenant_statement: () => buildTenantStatementPayload(),
    rpt_owner_statement: (args) => buildOwnerStatementPayload(args),
    rpt_income_statement: (args) => ({
      period: { from: args.p_from ?? '2026-01-01', to: args.p_to ?? '2026-12-31' },
      revenue: [
        { label: 'إيرادات الإيجارات', amount: 5040 },
        { label: 'إيرادات خدمات', amount: 320 },
      ],
      total_revenue: 5360,
      expenses: [
        { label: 'مصروفات صيانة', amount: 410 },
        { label: 'مصروفات مرافق', amount: 260 },
        { label: 'عمولات إدارة', amount: 252 },
      ],
      total_expenses: 922,
      net_income: 4438,
    }),
    rpt_balance_sheet: (args) => ({
      as_of: args.p_as_of ?? '2026-08-06',
      assets: [
        { code: '1001', name: 'الصندوق', amount: 1200 },
        { code: '1002', name: 'البنك', amount: 4800 },
        { code: '1100', name: 'ذمم مستأجرين', amount: 882 },
      ],
      total_assets: 6882,
      liabilities: [
        { code: '2001', name: 'تأمينات مستأجرين', amount: 840 },
        { code: '2002', name: 'ذمم موردين', amount: 310 },
      ],
      total_liabilities: 1150,
      equity: [
        { code: '3001', name: 'رأس المال', amount: 1300 },
        { code: '3002', name: 'أرباح مرحّلة', amount: 4432 },
      ],
      total_equity: 5732,
      is_balanced: true,
    }),
    rpt_cash_flow: () => ({
      period: { from: '2026-01-01', to: '2026-12-31' },
      opening_balance: 900,
      inflows: [{ label: 'تحصيلات إيجارات', amount: 4600 }],
      outflows: [{ label: 'مصروفات تشغيلية', amount: 920 }],
      closing_balance: 4580,
    }),
    rpt_vat_return: () => ({
      period: { from: '2026-01-01', to: '2026-12-31' },
      output_tax: 252.4,
      input_tax: 41.2,
      net_tax: 211.2,
    }),
  };

  return { failCompanySettings: mode === 'settings-unavailable', tables, rpcs };
}

/* ------------------------------------------------------------------ */
/* PostgREST-lite request handling                                      */
/* ------------------------------------------------------------------ */

type FilterOperation = {
  column: string;
  operator: string;
  value: string;
};

function parseFilterValue(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseInValues(raw: string): string[] {
  const inner = raw.trim().replace(/^\(/, '').replace(/\)$/, '');
  if (!inner) return [];
  return inner.split(',').map((part) => parseFilterValue(part));
}

function rowMatches(row: Record<string, unknown>, filter: FilterOperation): boolean {
  const cell = row[filter.column];
  switch (filter.operator) {
    case 'is':
      if (filter.value === 'null') return cell === null || cell === undefined;
      if (filter.value === 'true') return cell === true;
      if (filter.value === 'false') return cell === false;
      return String(cell) === filter.value;
    case 'eq':
      return String(cell) === filter.value;
    case 'neq':
      return String(cell) !== filter.value;
    case 'in':
      return parseInValues(filter.value).includes(String(cell));
    case 'gte':
    case 'gt':
    case 'lte':
    case 'lt': {
      const cellNumber = typeof cell === 'number' ? cell : Number.parseFloat(String(cell ?? ''));
      const valueNumber = Number.parseFloat(filter.value);
      if (Number.isFinite(cellNumber) && Number.isFinite(valueNumber)) {
        if (filter.operator === 'gte') return cellNumber >= valueNumber;
        if (filter.operator === 'gt') return cellNumber > valueNumber;
        if (filter.operator === 'lte') return cellNumber <= valueNumber;
        return cellNumber < valueNumber;
      }
      const cellText = String(cell ?? '');
      if (filter.operator === 'gte') return cellText >= filter.value;
      if (filter.operator === 'gt') return cellText > filter.value;
      if (filter.operator === 'lte') return cellText <= filter.value;
      return cellText < filter.value;
    }
    case 'ilike': {
      const pattern = filter.value.replaceAll('%', '').replaceAll('_', '');
      return String(cell ?? '').toLowerCase().includes(pattern.toLowerCase());
    }
    default:
      return true;
  }
}

function applyOrder(rows: Array<Record<string, unknown>>, orderParam: string | null): Array<Record<string, unknown>> {
  if (!orderParam) return rows;
  const directives = orderParam.split(',').map((directive) => directive.trim()).filter(Boolean).reverse();
  let ordered = rows;
  for (const directive of directives) {
    const [column, direction] = directive.split('.');
    const descending = direction?.startsWith('desc') ?? false;
    ordered = [...ordered].sort((left, right) => {
      const leftValue = left[column];
      const rightValue = right[column];
      const leftNumber = typeof leftValue === 'number' ? leftValue : Number.parseFloat(String(leftValue ?? ''));
      const rightNumber = typeof rightValue === 'number' ? rightValue : Number.parseFloat(String(rightValue ?? ''));
      let comparison: number;
      if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
        comparison = leftNumber - rightNumber;
      } else {
        comparison = String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
      }
      return descending ? -comparison : comparison;
    });
  }
  return ordered;
}

function fulfillJson(route: Route, status: number, body: unknown, headers: Record<string, string> = {}): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function handleTableRequest(route: Route, seed: AcceptanceSeed): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const table = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
  const method = request.method().toUpperCase();

  if (method !== 'GET' && method !== 'HEAD') {
    // The acceptance suite is read-only; mutating calls are intentionally
    // refused so a test can never silently fake a write.
    await fulfillJson(route, 405, { message: `Acceptance backend is read-only (${method} /${table})` });
    return;
  }

  if (table === 'company_settings' && seed.failCompanySettings) {
    // A failing settings read is a real production state: the document
    // platform must degrade to "not ready" instead of fabricating identity.
    await fulfillJson(route, 500, { message: 'acceptance backend: company settings unavailable' });
    return;
  }

  let rows: Array<Record<string, unknown>> = JSON.parse(JSON.stringify(seed.tables[table] ?? []));

  const reserved = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);
  for (const [key, rawValue] of url.searchParams.entries()) {
    if (reserved.has(key)) continue;
    // Embedded-resource filters (e.g. `contracts.tenant_id=eq.x`) are not
    // exercised by the acceptance flows — ignore instead of mis-filtering.
    if (key.includes('.')) continue;
    const separator = rawValue.indexOf('.');
    if (separator <= 0) continue;
    const filter: FilterOperation = {
      column: key,
      operator: rawValue.slice(0, separator),
      value: parseFilterValue(rawValue.slice(separator + 1)),
    };
    rows = rows.filter((row) => rowMatches(row, filter));
  }

  rows = applyOrder(rows, url.searchParams.get('order'));
  const total = rows.length;

  let start = 0;
  let end = total > 0 ? total - 1 : 0;
  const rawRange = await request.headerValue('range');
  const rangeHeader = typeof rawRange === 'string' ? rawRange : null;
  if (rangeHeader && /^\d+-\d+$/.test(rangeHeader)) {
    const [rangeStart, rangeEnd] = rangeHeader.split('-').map(Number);
    start = rangeStart;
    end = Math.min(rangeEnd, total > 0 ? total - 1 : 0);
  }
  const limitParam = Number(url.searchParams.get('limit') ?? Number.NaN);
  const offsetParam = Number(url.searchParams.get('offset') ?? 0);
  if (Number.isFinite(limitParam)) {
    start = offsetParam;
    end = total > 0 ? Math.min(offsetParam + limitParam - 1, total - 1) : 0;
  }

  const page = total === 0 ? [] : rows.slice(start, Math.min(end + 1, total));
  const rawPrefer = await request.headerValue('prefer');
  const prefer = typeof rawPrefer === 'string' ? rawPrefer : '';
  const countExact = prefer.includes('count=exact');
  const rawAccept = await request.headerValue('accept');
  const accept = typeof rawAccept === 'string' ? rawAccept : '';
  const wantsObject = accept.includes('application/vnd.pgrst.object');

  const rangeUnit = countExact ? String(total) : '*';
  const contentRange = total === 0 ? `*/${rangeUnit}` : `${start}-${Math.min(end, total - 1)}/${rangeUnit}`;

  if (wantsObject) {
    if (page.length === 0) {
      await fulfillJson(route, 406, {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
        details: `Results contain 0 rows`,
      }, { 'content-range': contentRange });
      return;
    }
    await fulfillJson(route, 200, page[0], { 'content-range': contentRange });
    return;
  }

  await fulfillJson(route, 200, page, { 'content-range': contentRange });
}

async function handleRpcRequest(route: Route, seed: AcceptanceSeed): Promise<void> {
  const request = route.request();
  const url = new URL(request.url());
  const functionName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
  let args: Record<string, unknown> = {};
  try {
    const text = request.postData();
    if (text) args = JSON.parse(text) as Record<string, unknown>;
  } catch {
    args = {};
  }

  const handler = seed.rpcs[functionName];
  if (!handler) {
    // Lenient default: financial report normalizers accept empty objects and
    // degrade to zeroed/empty reports, keeping unrelated sections renderable.
    await fulfillJson(route, 200, {});
    return;
  }
  await fulfillJson(route, 200, handler(args));
}

async function handleAuthRequest(route: Route): Promise<void> {
  const url = new URL(route.request().url());
  if (route.request().method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    return;
  }
  const user = {
    id: IDS.user,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'acceptance@malek.test',
    app_metadata: {
      provider: 'email',
      providers: ['email'],
      user_role: 'ADMIN',
      role: 'ADMIN',
      company_id: IDS.company,
    },
    user_metadata: { full_name: 'اختبار القبول' },
    created_at: '2026-01-01T08:00:00.000Z',
    updated_at: '2026-01-01T08:00:00.000Z',
  };
  if (url.pathname.endsWith('/user')) {
    await fulfillJson(route, 200, user);
    return;
  }
  if (url.pathname.endsWith('/token')) {
    // Refresh flows (e.g. the company provider's one-time session refresh)
    // receive the same long-lived seeded session.
    await fulfillJson(route, 200, {
      access_token: 'acceptance-access-token',
      refresh_token: 'acceptance-refresh-token',
      expires_in: 43200,
      expires_at: Math.floor(Date.now() / 1000) + 43200,
      token_type: 'bearer',
      user,
    });
    return;
  }
  await fulfillJson(route, 200, {});
}

/**
 * Installs the seeded Supabase boundary on a page. Matches any origin —
 * the CI dev server runs with placeholder env values and the client
 * resolves them to `https://invalid.supabase.local`.
 */
export async function installFakeSupabaseBackend(page: Page, mode: CompanySettingsMode = 'complete'): Promise<AcceptanceSeed> {
  const seed = buildAcceptanceSeed(mode);
  await page.route('**/rest/v1/rpc/*', (route) => handleRpcRequest(route, seed));
  await page.route('**/rest/v1/*', (route) => handleTableRequest(route, seed));
  await page.route('**/auth/v1/**', (route) => handleAuthRequest(route));
  await page.route('**/storage/v1/**', (route) => fulfillJson(route, 404, { message: 'no storage in acceptance backend' }));
  return seed;
}
