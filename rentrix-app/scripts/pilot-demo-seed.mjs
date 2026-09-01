import { createClient } from '@supabase/supabase-js';

const ENVIRONMENT_KIND = process.env.PILOT_ENVIRONMENT_KIND?.trim().toLowerCase();
const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim();
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY?.trim();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const PRODUCTION_REF = process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim();
const QA_REF = process.env.QA_SUPABASE_PROJECT_REF?.trim();
const EMAIL = process.env.PILOT_DEMO_EMAIL?.trim();
const PASSWORD = process.env.PILOT_DEMO_PASSWORD?.trim();
const CHECKER_EMAIL = process.env.PILOT_DEMO_CHECKER_EMAIL?.trim() ?? 'pilot-demo-checker@malek.test';
const CHECKER_PASSWORD = process.env.PILOT_DEMO_CHECKER_PASSWORD?.trim() ?? PASSWORD;

const COMPANY_ID = '00000000-0000-4000-8000-000000000101';
const TAG = 'malek-pilot-demo-v1';

const required = {
  PILOT_ENVIRONMENT_KIND: ENVIRONMENT_KIND,
  VITE_SUPABASE_URL: SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
  PILOT_DEMO_EMAIL: EMAIL,
  PILOT_DEMO_PASSWORD: PASSWORD,
};
for (const [name, value] of Object.entries(required)) {
  if (!value) throw new Error(`${name} is required for the MALEK pilot demo seed.`);
}
if (!['local', 'qa'].includes(ENVIRONMENT_KIND)) {
  throw new Error('Pilot demo mutation is allowed only on local or the dedicated QA Supabase stack.');
}

const supabaseUrl = new URL(SUPABASE_URL);
if (supabaseUrl.hostname === `${PRODUCTION_REF}.supabase.co` || supabaseUrl.hostname.startsWith(`${PRODUCTION_REF}.`)) {
  throw new Error('Refusing to seed the MALEK pilot demo against Production.');
}
if (ENVIRONMENT_KIND === 'qa') {
  if (!QA_REF || supabaseUrl.hostname !== `${QA_REF}.supabase.co`) {
    throw new Error('QA pilot seed requires QA_SUPABASE_PROJECT_REF matching VITE_SUPABASE_URL exactly.');
  }
  if (process.env.QA_MUTATION_APPROVED !== '1') {
    throw new Error('QA pilot seed requires QA_MUTATION_APPROVED=1.');
  }
}

const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function assertNoError(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`, { cause: result.error });
  return result.data;
}

async function upsert(table, row, onConflict = 'id') {
  assertNoError(`upsert ${table}`, await service.from(table).upsert(row, { onConflict }));
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function currentMonth() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    end: isoDate(new Date(Date.UTC(year, month + 1, 0))),
    today: isoDate(now),
  };
}

async function ensureIdentity(email, password, name) {
  let user = null;
  for (let page = 1; !user; page += 1) {
    const listed = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (listed.error) throw listed.error;
    user = listed.data.users.find((candidate) => candidate.email === email) ?? null;
    if (listed.data.users.length < 1000) break;
  }

  if (!user) {
    const created = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'ADMIN', user_role: 'ADMIN', company_id: COMPANY_ID },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error(`Could not create ${name}.`);
    user = created.data.user;
  } else {
    const updated = await service.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      app_metadata: { role: 'ADMIN', user_role: 'ADMIN', company_id: COMPANY_ID },
    });
    if (updated.error || !updated.data.user) throw updated.error ?? new Error(`Could not refresh ${name}.`);
    user = updated.data.user;
  }

  await upsert('users', {
    id: user.id,
    email,
    name,
    full_name: name,
    role: 'ADMIN',
    status: 'ACTIVE',
    is_active: true,
    deleted_at: null,
  });
  await upsert('company_members', {
    company_id: COMPANY_ID,
    user_id: user.id,
    role: 'ADMIN',
    is_active: true,
  }, 'company_id,user_id');
  return user;
}

async function signIn(email, password, label) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  assertNoError(`sign in ${label}`, signedIn);
  const companyClaim = signedIn.data.session?.user?.app_metadata?.company_id
    ?? signedIn.data.session?.user?.app_metadata?.companyId;
  if (companyClaim !== COMPANY_ID) throw new Error(`${label} is missing the pilot company claim.`);
  return client;
}

const owners = [
  ['00000000-0000-4000-8100-000000000001', 'أحمد بن سالم الحارثي', 'أحمد الحارثي'],
  ['00000000-0000-4000-8100-000000000002', 'مريم بنت راشد البلوشية', 'مريم البلوشية'],
  ['00000000-0000-4000-8100-000000000003', 'خالد بن ناصر المعمري', 'خالد المعمري'],
];
const properties = [
  ['00000000-0000-4000-8200-000000000001', owners[0][0], 'بناية الخوير التجارية', 'مسقط — الخوير', 10],
  ['00000000-0000-4000-8200-000000000002', owners[1][0], 'مجمع الموج السكني', 'مسقط — الموج', 8],
  ['00000000-0000-4000-8200-000000000003', owners[2][0], 'بناية صحار الجديدة', 'صحار — الحي التجاري', 7.5],
];
const units = [
  ['00000000-0000-4000-8300-000000000001', properties[0][0], '101', 420],
  ['00000000-0000-4000-8300-000000000002', properties[0][0], '102', 480],
  ['00000000-0000-4000-8300-000000000003', properties[1][0], 'A-11', 650],
  ['00000000-0000-4000-8300-000000000004', properties[1][0], 'A-12', 700],
  ['00000000-0000-4000-8300-000000000005', properties[2][0], '201', 350],
  ['00000000-0000-4000-8300-000000000006', properties[2][0], '202', 375],
];
const tenants = [
  ['00000000-0000-4000-8400-000000000001', 'يوسف محمد الشحي'],
  ['00000000-0000-4000-8400-000000000002', 'سارة عبدالله الهنائية'],
  ['00000000-0000-4000-8400-000000000003', 'شركة المدار الحديثة ش.م.م'],
  ['00000000-0000-4000-8400-000000000004', 'راشد علي المقبالي'],
  ['00000000-0000-4000-8400-000000000005', 'فاطمة سالم الرواحية'],
];
const contractPlans = [
  { unit: units[0], tenant: tenants[0], paymentTarget: 1 },
  { unit: units[1], tenant: tenants[1], paymentTarget: 0.5 },
  { unit: units[2], tenant: tenants[2], paymentTarget: 1 },
  { unit: units[3], tenant: tenants[3], paymentTarget: 0 },
  { unit: units[4], tenant: tenants[4], paymentTarget: 0 },
];

async function prepareMasterData(maker, checker) {
  const { start, end } = currentMonth();
  await upsert('companies', { id: COMPANY_ID, name: 'مكتب مالك العقاري — نسخة العرض', slug: 'malek-pilot-demo', is_active: true });
  await upsert('company_settings', {
    id: '00000000-0000-4000-8000-000000000102',
    singleton_key: true,
    company_name: 'مكتب مالك العقاري — نسخة العرض',
    currency: 'OMR',
    vat_enabled: false,
    vat_rate: 0,
    company_id: COMPANY_ID,
  });

  assertNoError('provision chart of accounts', await service.rpc('provision_company_chart_of_accounts', { p_company_id: COMPANY_ID }));
  await upsert('company_tax_profiles', {
    id: '00000000-0000-4000-8000-000000000103',
    company_id: COMPANY_ID,
    version_no: 1,
    tax_code: 'NON_TAXABLE',
    tax_rate: 0,
    effective_from: '2020-01-01',
    effective_to: '2039-12-31',
    status: 'ACTIVE',
    description: `${TAG}: non-taxable rent`,
    created_by: maker.id,
    approved_by: checker.id,
    approved_at: new Date().toISOString(),
  });
  await upsert('company_fee_tax_treatments', {
    id: '00000000-0000-4000-8000-000000000104',
    company_id: COMPANY_ID,
    fee_kind: 'RATE_MANAGEMENT_FEE',
    version_no: 1,
    tax_code: 'NON_TAXABLE',
    tax_rate: 0,
    effective_from: '2020-01-01',
    effective_to: '2039-12-31',
    status: 'ACTIVE',
    created_by: maker.id,
    approved_by: checker.id,
    approved_at: new Date().toISOString(),
  });
  await upsert('accounting_periods', {
    id: '00000000-0000-4000-8000-000000000105',
    company_id: COMPANY_ID,
    name: `Pilot ${start}..${end}`,
    start_date: start,
    end_date: end,
    status: 'OPEN',
  });

  for (const [id, fullName, displayName] of owners) {
    await upsert('owners', { id, full_name: fullName, display_name: displayName, is_active: true, company_id: COMPANY_ID });
  }

  for (let i = 0; i < properties.length; i += 1) {
    const [id, ownerId, title, address, commission] = properties[i];
    await upsert('properties', { id, title, type: i === 0 ? 'commercial' : 'residential', address, status: 'active', company_id: COMPANY_ID });
    await upsert('property_owners', {
      id: `00000000-0000-4000-8250-00000000000${i + 1}`,
      property_id: id,
      owner_id: ownerId,
      ownership_percentage: 100,
      is_primary: true,
      starts_on: '2020-01-01',
      ends_on: '2039-12-31',
      company_id: COMPANY_ID,
    });
    const agreementId = `00000000-0000-4000-8500-00000000000${i + 1}`;
    const versionId = `00000000-0000-4000-8510-00000000000${i + 1}`;
    await upsert('owner_agreements', {
      id: agreementId,
      owner_id: ownerId,
      property_id: id,
      agreement_type: 'property_management',
      commission_type: 'RATE',
      commission_value: commission,
      starts_on: '2020-01-01',
      ends_on: '2039-12-31',
      notes: TAG,
      company_id: COMPANY_ID,
    });
    await upsert('owner_agreement_versions', {
      id: versionId,
      owner_agreement_id: agreementId,
      company_id: COMPANY_ID,
      version_no: 2,
      operating_model: 'OWNER_AGENCY',
      collection_role: 'OWNER_IS_CREDITOR',
      commission_type: 'RATE',
      commission_value: commission,
      commission_recognition_basis: 'ON_COLLECTION',
      offset_allowed: false,
      reserve_amount: 0,
      effective_from: '2020-01-01',
      effective_to: '2039-12-31',
      created_by: maker.id,
    });
    assertNoError(`pin agreement version ${i + 1}`, await service.from('owner_agreements').update({ current_version_id: versionId }).eq('id', agreementId));
  }

  for (const [id, propertyId, unitNumber, rent] of units) {
    await upsert('units', { id, property_id: propertyId, unit_number: unitNumber, status: 'available', rent_amount: rent, company_id: COMPANY_ID });
  }
  for (const [id, fullName] of tenants) {
    await upsert('people', { id, full_name: fullName, type: 'tenant', company_id: COMPANY_ID });
  }
}

function agreementForProperty(propertyId) {
  const index = properties.findIndex(([id]) => id === propertyId);
  if (index < 0) throw new Error(`No pilot agreement for property ${propertyId}`);
  return `00000000-0000-4000-8500-00000000000${index + 1}`;
}

async function ensureContract(makerClient, checkerClient, plan, index) {
  const [unitId, propertyId, unitNumber, rent] = plan.unit;
  const [tenantId] = plan.tenant;
  const existing = assertNoError(
    `find contract ${unitNumber}`,
    await service.from('contracts')
      .select('id,status,approval_status')
      .eq('company_id', COMPANY_ID)
      .eq('unit_id', unitId)
      .eq('tenant_id', tenantId)
      .eq('notes', `${TAG}:contract:${index + 1}`)
      .is('deleted_at', null)
      .maybeSingle(),
  );
  if (existing?.id) return existing.id;

  const { start } = currentMonth();
  const created = assertNoError(
    `create contract ${unitNumber}`,
    await makerClient.rpc('create_contract_atomic_v2', {
      p_property_id: propertyId,
      p_unit_id: unitId,
      p_tenant_id: tenantId,
      p_agreement_id: agreementForProperty(propertyId),
      p_start_date: start,
      p_end_date: '2030-12-31',
      p_rent_amount: rent,
      p_payment_cycle: 'monthly',
      p_payment_terms_id: null,
      p_status: 'draft',
      p_cancellation_reason: null,
      p_notes: `${TAG}:contract:${index + 1}`,
      p_attachment_url: null,
      p_billing_day: 1,
      p_grace_days: 5,
      p_lease_mode: 'long_term',
      p_daily_reference_rate: null,
    }),
  );
  const contractId = String(created?.id ?? '');
  if (!contractId) throw new Error(`Contract ${unitNumber} returned no id.`);

  assertNoError(`submit contract ${unitNumber}`, await makerClient.rpc('submit_contract_for_approval_atomic', {
    p_contract_id: contractId,
    p_maker_signature: 'MALEK Pilot Maker',
  }));
  assertNoError(`approve contract ${unitNumber}`, await checkerClient.rpc('approve_contract_atomic', {
    p_contract_id: contractId,
    p_checker_signature: 'MALEK Pilot Checker',
  }));
  assertNoError(`activate contract ${unitNumber}`, await makerClient.rpc('activate_contract_with_agreement_snapshot_atomic', {
    p_contract_id: contractId,
  }));
  return contractId;
}

async function seedFinancialActivity(makerClient, contractIds) {
  const { today } = currentMonth();
  assertNoError('generate current invoices', await makerClient.rpc('generate_invoices_from_active_contracts'));

  const invoices = assertNoError(
    'load pilot invoices',
    await service.from('invoices')
      .select('id,contract_id,amount,paid_amount,status,billing_period_start,billing_period_end')
      .in('contract_id', contractIds)
      .is('deleted_at', null),
  ) ?? [];

  for (let i = 0; i < contractPlans.length; i += 1) {
    const invoice = invoices.find((candidate) => candidate.contract_id === contractIds[i]);
    if (!invoice) throw new Error(`No generated invoice for pilot contract ${contractIds[i]}.`);
    const desiredPaid = Number(invoice.amount) * contractPlans[i].paymentTarget;
    const remaining = Math.round((desiredPaid - Number(invoice.paid_amount ?? 0)) * 1000) / 1000;
    if (remaining > 0.0001) {
      assertNoError(`record pilot payment ${i + 1}`, await makerClient.rpc('record_invoice_payment_atomic', {
        payload: {
          invoice_id: invoice.id,
          amount: remaining,
          method: i === 2 ? 'bank_transfer' : 'cash',
          date: today,
          reference: `PILOT-PAY-${String(i + 1).padStart(2, '0')}`,
          request_id: `00000000-0000-4000-8700-00000000000${i + 1}`,
        },
      }));
    }
  }

  const expensePayloads = [
    {
      request_id: '00000000-0000-4000-8800-000000000001',
      property_id: properties[0][0], category: 'صيانة', amount: 35.5,
      expense_date: today, charged_to: 'OWNER', description: `${TAG}: صيانة تكييف على حساب المالك`,
    },
    {
      request_id: '00000000-0000-4000-8800-000000000002',
      property_id: properties[1][0], category: 'خدمات', amount: 18.75,
      expense_date: today, charged_to: 'OWNER', description: `${TAG}: خدمة دورية على حساب المالك`,
    },
    {
      request_id: '00000000-0000-4000-8800-000000000003',
      property_id: properties[2][0], category: 'تشغيل المكتب', amount: 12,
      expense_date: today, charged_to: 'COMPANY', description: `${TAG}: مصروف تشغيلي لا يخص المالك`,
    },
  ];
  for (const payload of expensePayloads) {
    assertNoError(`create expense ${payload.request_id}`, await makerClient.rpc('create_expense_with_journal_atomic', { p_payload: payload }));
  }

  return invoices;
}

async function verify(contractIds) {
  const [propertiesCount, unitsCount, ownersCount, tenantsCount, contractsCount, invoicesCount, receiptsCount, expensesCount] = await Promise.all([
    service.from('properties').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    service.from('units').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    service.from('owners').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    service.from('people').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).eq('type', 'tenant'),
    service.from('contracts').select('id', { count: 'exact', head: true }).in('id', contractIds),
    service.from('invoices').select('id', { count: 'exact', head: true }).in('contract_id', contractIds),
    service.from('receipts').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    service.from('expenses').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
  ]);
  for (const [label, result] of Object.entries({ propertiesCount, unitsCount, ownersCount, tenantsCount, contractsCount, invoicesCount, receiptsCount, expensesCount })) {
    if (result.error) throw new Error(`${label}: ${result.error.message}`);
  }
  const summary = {
    environment: ENVIRONMENT_KIND,
    companyId: COMPANY_ID,
    companyName: 'مكتب مالك العقاري — نسخة العرض',
    dataset: TAG,
    counts: {
      properties: propertiesCount.count ?? 0,
      units: unitsCount.count ?? 0,
      owners: ownersCount.count ?? 0,
      tenants: tenantsCount.count ?? 0,
      contracts: contractsCount.count ?? 0,
      invoices: invoicesCount.count ?? 0,
      receipts: receiptsCount.count ?? 0,
      expenses: expensesCount.count ?? 0,
    },
    intendedScenarios: ['تحصيل كامل', 'تحصيل جزئي', 'فاتورة غير محصلة', 'مصروف مالك', 'مصروف مكتب', 'Maker/Checker contract approval'],
    productionMutation: false,
    verifiedAt: new Date().toISOString(),
  };
  if (summary.counts.properties < 3 || summary.counts.units < 6 || summary.counts.contracts < 5 || summary.counts.invoices < 5) {
    throw new Error(`Pilot dataset is incomplete: ${JSON.stringify(summary.counts)}`);
  }
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  const maker = await ensureIdentity(EMAIL, PASSWORD, 'مدير مكتب مالك التجريبي');
  const checker = await ensureIdentity(CHECKER_EMAIL, CHECKER_PASSWORD, 'مراجع مكتب مالك التجريبي');
  await prepareMasterData(maker, checker);
  const makerClient = await signIn(EMAIL, PASSWORD, 'pilot maker');
  const checkerClient = await signIn(CHECKER_EMAIL, CHECKER_PASSWORD, 'pilot checker');
  const contractIds = [];
  for (let i = 0; i < contractPlans.length; i += 1) {
    contractIds.push(await ensureContract(makerClient, checkerClient, contractPlans[i], i));
  }
  await seedFinancialActivity(makerClient, contractIds);
  await verify(contractIds);
}

await main();
