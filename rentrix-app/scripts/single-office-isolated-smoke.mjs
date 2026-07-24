import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const COMPANY_ID = '00000000-0000-4000-8000-000000000001';
const EMAIL = process.env.E2E_SINGLE_OFFICE_EMAIL ?? 'single-office-admin@rentrix.test';
const PASSWORD = process.env.E2E_SINGLE_OFFICE_PASSWORD ?? 'SingleOffice-Aa1!';
const PAYMENT_REFERENCE = 'SO-E2E-001';
const PAYMENT_DATE = '2026-07-25';
const IDS = {
  owner: '00000000-0000-0000-0000-000000009201',
  property: '00000000-0000-0000-0000-000000009301',
  unit: '00000000-0000-0000-0000-000000009401',
  tenant: '00000000-0000-0000-0000-000000009501',
  propertyOwner: '00000000-0000-0000-0000-000000009551',
  agreement: '00000000-0000-0000-0000-000000009601',
  contract: '00000000-0000-0000-0000-000000009701',
  invoice: '00000000-0000-0000-0000-000000009801',
};

const requiredEnvironment = [
  'E2E_ENVIRONMENT_KIND',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PRODUCTION_SUPABASE_PROJECT_REF',
];

for (const name of requiredEnvironment) {
  if (!process.env[name]?.trim()) throw new Error(`${name} is required for the single-office isolated smoke.`);
}

if (process.env.E2E_ENVIRONMENT_KIND.trim().toLowerCase() !== 'local') {
  throw new Error('The single-office mutation smoke is allowed only on a disposable local Supabase stack.');
}

const supabaseUrl = new URL(process.env.VITE_SUPABASE_URL.trim());
const productionRef = process.env.PRODUCTION_SUPABASE_PROJECT_REF.trim();
if (supabaseUrl.hostname === `${productionRef}.supabase.co` || supabaseUrl.hostname.startsWith(`${productionRef}.`)) {
  throw new Error('Refusing to run the single-office mutation smoke against Production.');
}

const serviceClient = createClient(supabaseUrl.toString(), process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const authenticatedClient = createClient(supabaseUrl.toString(), process.env.VITE_SUPABASE_ANON_KEY.trim(), {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function assertNoError(label, result) {
  if (result.error) throw new Error(`${label} failed: ${result.error.message}`, { cause: result.error });
  return result.data;
}

async function upsert(table, row, onConflict = 'id') {
  const result = await serviceClient.from(table).upsert(row, { onConflict });
  assertNoError(`upsert ${table}`, result);
}

async function writeEvidence(payload) {
  const evidencePath = process.env.SINGLE_OFFICE_EVIDENCE_PATH?.trim();
  if (!evidencePath) return;
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function ensureIdentity() {
  const usersResult = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersResult.error) throw usersResult.error;

  let user = usersResult.data.users.find((candidate) => candidate.email === EMAIL) ?? null;
  if (!user) {
    const created = await serviceClient.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'ADMIN', user_role: 'ADMIN', company_id: COMPANY_ID },
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error('Could not create the single-office smoke identity.');
    }
    user = created.data.user;
  } else {
    const updated = await serviceClient.auth.admin.updateUserById(user.id, {
      password: PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'ADMIN', user_role: 'ADMIN', company_id: COMPANY_ID },
    });
    if (updated.error || !updated.data.user) throw updated.error ?? new Error('Could not refresh the smoke identity.');
    user = updated.data.user;
  }

  await upsert('users', {
    id: user.id,
    email: EMAIL,
    name: 'Single Office Admin',
    full_name: 'Single Office Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    is_active: true,
    deleted_at: null,
  });
  await upsert('company_members', {
    company_id: COMPANY_ID,
    user_id: user.id,
    role: 'OWNER',
    is_active: true,
  }, 'company_id,user_id');

  return user;
}

async function seed() {
  const user = await ensureIdentity();

  const accounts = assertNoError(
    'load canonical accounts',
    await serviceClient.from('accounts').select('id,no,company_id').eq('company_id', COMPANY_ID)
      .in('no', ['1111', '1201', '2000', '2100', '4000']),
  ) ?? [];
  const accountCounts = new Map();
  for (const account of accounts) {
    accountCounts.set(account.no, (accountCounts.get(account.no) ?? 0) + 1);
  }
  for (const required of ['1111', '1201', '2000', '2100', '4000']) {
    const count = accountCounts.get(required) ?? 0;
    if (count !== 1) {
      throw new Error(`Canonical account ${required} must exist exactly once for the launch company; found ${count}.`);
    }
  }

  await upsert('owners', {
    id: IDS.owner,
    full_name: 'مالك اختبار المكتب الواحد',
    display_name: 'مالك المكتب الواحد',
    is_active: true,
    company_id: COMPANY_ID,
  });
  await upsert('properties', {
    id: IDS.property,
    title: 'عقار اختبار المكتب الواحد',
    type: 'residential',
    address: 'مسقط — بيئة الإطلاق المعزولة',
    status: 'active',
    company_id: COMPANY_ID,
  });
  await upsert('units', {
    id: IDS.unit,
    property_id: IDS.property,
    unit_number: 'SO-E2E-1',
    status: 'available',
    rent_amount: 1000,
    company_id: COMPANY_ID,
  });
  await upsert('people', {
    id: IDS.tenant,
    full_name: 'مستأجر اختبار المكتب الواحد',
    type: 'tenant',
    company_id: COMPANY_ID,
  });
  await upsert('property_owners', {
    id: IDS.propertyOwner,
    property_id: IDS.property,
    owner_id: IDS.owner,
    ownership_percentage: 100,
    is_primary: true,
    starts_on: '2026-01-01',
    ends_on: '2027-12-31',
    company_id: COMPANY_ID,
  });
  await upsert('owner_agreements', {
    id: IDS.agreement,
    owner_id: IDS.owner,
    property_id: IDS.property,
    agreement_type: 'property_management',
    commission_type: 'RATE',
    commission_value: 10,
    starts_on: '2026-01-01',
    ends_on: '2027-12-31',
    notes: 'single-office-isolated-smoke',
    company_id: COMPANY_ID,
  });
  await upsert('contracts', {
    id: IDS.contract,
    property_id: IDS.property,
    unit_id: IDS.unit,
    tenant_id: IDS.tenant,
    agreement_id: IDS.agreement,
    start_date: '2026-07-01',
    end_date: '2027-06-30',
    rent_amount: 1000,
    payment_cycle: 'monthly',
    status: 'active',
    notes: 'single-office-isolated-smoke',
    company_id: COMPANY_ID,
  });
  await upsert('invoices', {
    id: IDS.invoice,
    contract_id: IDS.contract,
    issue_date: '2026-07-01',
    due_date: '2026-07-25',
    amount: 1000,
    paid_amount: 0,
    tax_amount: 0,
    status: 'UNPAID',
    notes: 'single-office-isolated-smoke',
    company_id: COMPANY_ID,
  });

  const evidence = {
    action: 'seed',
    environment: 'disposable-local-supabase',
    productionMutation: false,
    companyId: COMPANY_ID,
    userId: user.id,
    email: EMAIL,
    canonicalAccounts: Object.fromEntries([...accountCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    ids: IDS,
    paymentReference: PAYMENT_REFERENCE,
    paymentDate: PAYMENT_DATE,
    seededAt: new Date().toISOString(),
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence));
}

async function verify() {
  const signedIn = await authenticatedClient.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  assertNoError('sign in for lifecycle verification', signedIn);

  const invoice = assertNoError(
    'load lifecycle invoice',
    await serviceClient.from('invoices').select('id,status,paid_amount').eq('id', IDS.invoice).single(),
  );
  const payments = assertNoError(
    'load lifecycle payment',
    await serviceClient.from('payments').select('id,receipt_id,status,amount,reference_number')
      .eq('reference_number', PAYMENT_REFERENCE),
  ) ?? [];

  if (payments.length !== 1) throw new Error(`Expected exactly one lifecycle payment, found ${payments.length}.`);
  const [payment] = payments;

  const receipt = assertNoError(
    'load lifecycle receipt',
    await serviceClient.from('receipts').select('id,status,voided_at,request_id').eq('id', payment.receipt_id).single(),
  );
  const allocations = assertNoError(
    'load lifecycle allocations',
    await serviceClient.from('receipt_allocations').select('id').eq('receipt_id', payment.receipt_id),
  ) ?? [];
  const reversalEntries = assertNoError(
    'load lifecycle reversal journal',
    await serviceClient.from('journal_entries').select('id,debit,credit,entity_type,entity_id')
      .eq('entity_type', 'receipt_void').eq('entity_id', payment.receipt_id),
  ) ?? [];
  const idempotencyRows = assertNoError(
    'load lifecycle idempotency keys',
    await serviceClient.from('financial_operation_idempotency').select('operation_name,request_id,response_payload')
      .in('operation_name', [
        `record_invoice_payment_atomic:${COMPANY_ID}`,
        `post_receipt_atomic:${COMPANY_ID}`,
        `void_receipt_atomic:${COMPANY_ID}`,
      ]),
  ) ?? [];
  const paymentKeys = idempotencyRows.filter((row) => (
    row.operation_name === `record_invoice_payment_atomic:${COMPANY_ID}`
      && row.request_id === receipt.request_id
      && row.response_payload?._target_id === IDS.invoice
  ));
  const postReceiptKeys = idempotencyRows.filter((row) => (
    row.operation_name === `post_receipt_atomic:${COMPANY_ID}`
      && row.request_id === receipt.request_id
      && row.response_payload?._target_id === `receipt:${payment.receipt_id}`
  ));
  const voidKeys = idempotencyRows.filter((row) => (
    row.operation_name === `void_receipt_atomic:${COMPANY_ID}`
      && row.response_payload?._target_id === payment.receipt_id
  ));

  const normalizedInvoiceStatus = String(invoice.status).toUpperCase();
  if (Number(invoice.paid_amount) !== 0 || !['UNPAID', 'OVERDUE'].includes(normalizedInvoiceStatus)) {
    throw new Error(`VOID did not restore the invoice: status=${invoice.status} paid_amount=${invoice.paid_amount}.`);
  }
  if (payment.status !== 'VOID' || receipt.status !== 'VOID' || !receipt.voided_at) {
    throw new Error('Payment and receipt were not both preserved as VOID audit history.');
  }
  if (allocations.length !== 1) throw new Error(`Expected one preserved allocation, found ${allocations.length}.`);
  if (reversalEntries.length !== 2) throw new Error(`Expected two reversal journal entries, found ${reversalEntries.length}.`);
  if (paymentKeys.length !== 1 || postReceiptKeys.length !== 1 || voidKeys.length !== 1) {
    throw new Error(
      `Expected one payment, post-receipt, and void key; found ${paymentKeys.length}/${postReceiptKeys.length}/${voidKeys.length}.`,
    );
  }

  const debit = reversalEntries.reduce((sum, entry) => sum + Number(entry.debit ?? 0), 0);
  const credit = reversalEntries.reduce((sum, entry) => sum + Number(entry.credit ?? 0), 0);
  if (Math.abs(debit - credit) > 0.0001 || debit !== 1000) {
    throw new Error(`Reversal journal is not balanced for 1000: debit=${debit} credit=${credit}.`);
  }

  const report = await authenticatedClient.rpc('rpt_daily_collection', {
    p_from: PAYMENT_DATE,
    p_to: PAYMENT_DATE,
  });
  assertNoError('run daily collection report after VOID', report);
  const reportRows = Array.isArray(report.data) ? report.data : (report.data ?? []);
  if (JSON.stringify(reportRows).includes(PAYMENT_REFERENCE)) {
    throw new Error('VOID payment unexpectedly remained in daily collection reporting.');
  }

  const evidence = {
    action: 'verify',
    environment: 'disposable-local-supabase',
    productionMutation: false,
    companyId: COMPANY_ID,
    invoice: { id: invoice.id, status: invoice.status, paidAmount: Number(invoice.paid_amount) },
    payment: { id: payment.id, status: payment.status, amount: Number(payment.amount) },
    receipt: { id: receipt.id, status: receipt.status, voidedAt: receipt.voided_at },
    preservedAllocationCount: allocations.length,
    reversal: { entries: reversalEntries.length, debit, credit },
    idempotency: {
      paymentKeys: paymentKeys.length,
      postReceiptKeys: postReceiptKeys.length,
      voidKeys: voidKeys.length,
    },
    dailyCollectionAfterVoid: reportRows,
    verifiedAt: new Date().toISOString(),
  };
  await writeEvidence(evidence);
  console.log(JSON.stringify(evidence));
}

const action = process.argv[2];
if (action === 'seed') await seed();
else if (action === 'verify') await verify();
else throw new Error('Usage: node scripts/single-office-isolated-smoke.mjs <seed|verify>');
