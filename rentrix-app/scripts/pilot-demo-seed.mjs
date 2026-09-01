import { createClient } from '@supabase/supabase-js';

const env = {
  kind: process.env.PILOT_ENVIRONMENT_KIND?.trim().toLowerCase(),
  url: process.env.VITE_SUPABASE_URL?.trim(),
  anon: process.env.VITE_SUPABASE_ANON_KEY?.trim(),
  service: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  productionRef: process.env.PRODUCTION_SUPABASE_PROJECT_REF?.trim(),
  qaRef: process.env.QA_SUPABASE_PROJECT_REF?.trim(),
  email: process.env.PILOT_DEMO_EMAIL?.trim(),
  password: process.env.PILOT_DEMO_PASSWORD?.trim(),
  checkerEmail: process.env.PILOT_DEMO_CHECKER_EMAIL?.trim() ?? 'pilot-demo-checker@malek.test',
  checkerPassword: process.env.PILOT_DEMO_CHECKER_PASSWORD?.trim() ?? process.env.PILOT_DEMO_PASSWORD?.trim(),
};

const COMPANY_ID = '00000000-0000-4000-8000-000000000101';
const COMPANY_NAME = 'مكتب مالك العقاري — نسخة العرض';
const TAG = 'malek-pilot-demo-v1';

for (const [name, value] of Object.entries({
  PILOT_ENVIRONMENT_KIND: env.kind,
  VITE_SUPABASE_URL: env.url,
  VITE_SUPABASE_ANON_KEY: env.anon,
  SUPABASE_SERVICE_ROLE_KEY: env.service,
  PRODUCTION_SUPABASE_PROJECT_REF: env.productionRef,
  PILOT_DEMO_EMAIL: env.email,
  PILOT_DEMO_PASSWORD: env.password,
})) {
  if (!value) throw new Error(`${name} is required for the MALEK pilot demo seed.`);
}
if (!['local', 'qa'].includes(env.kind)) {
  throw new Error('Pilot demo mutation is allowed only on local or the dedicated QA Supabase stack.');
}
const target = new URL(env.url);
if (target.hostname === `${env.productionRef}.supabase.co` || target.hostname.startsWith(`${env.productionRef}.`)) {
  throw new Error('Refusing to seed the MALEK pilot demo against Production.');
}
if (env.kind === 'qa') {
  if (!env.qaRef || target.hostname !== `${env.qaRef}.supabase.co`) {
    throw new Error('QA pilot seed requires QA_SUPABASE_PROJECT_REF matching VITE_SUPABASE_URL exactly.');
  }
  if (process.env.QA_MUTATION_APPROVED !== '1') throw new Error('QA pilot seed requires QA_MUTATION_APPROVED=1.');
}

const service = createClient(env.url, env.service, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function dataOrThrow(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`, { cause: result.error });
  return result.data;
}
async function upsert(table, row, onConflict = 'id') {
  dataOrThrow(`upsert ${table}`, await service.from(table).upsert(row, { onConflict }));
}
function iso(date) { return date.toISOString().slice(0, 10); }
function monthRange() {
  const now = new Date();
  return {
    start: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`,
    end: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))),
    today: iso(now),
  };
}

const owners = [
  { id: '00000000-0000-4000-8100-000000000001', full: 'أحمد بن سالم الحارثي', display: 'أحمد الحارثي' },
  { id: '00000000-0000-4000-8100-000000000002', full: 'مريم بنت راشد البلوشية', display: 'مريم البلوشية' },
  { id: '00000000-0000-4000-8100-000000000003', full: 'خالد بن ناصر المعمري', display: 'خالد المعمري' },
];
const properties = [
  { id: '00000000-0000-4000-8200-000000000001', owner: owners[0].id, title: 'بناية الخوير التجارية', address: 'مسقط — الخوير', type: 'commercial', fee: 10 },
  { id: '00000000-0000-4000-8200-000000000002', owner: owners[1].id, title: 'مجمع الموج السكني', address: 'مسقط — الموج', type: 'residential', fee: 8 },
  { id: '00000000-0000-4000-8200-000000000003', owner: owners[2].id, title: 'بناية صحار الجديدة', address: 'صحار — الحي التجاري', type: 'residential', fee: 7.5 },
];
const units = [
  { id: '00000000-0000-4000-8300-000000000001', property: properties[0].id, number: '101', rent: 420 },
  { id: '00000000-0000-4000-8300-000000000002', property: properties[0].id, number: '102', rent: 480 },
  { id: '00000000-0000-4000-8300-000000000003', property: properties[1].id, number: 'A-11', rent: 650 },
  { id: '00000000-0000-4000-8300-000000000004', property: properties[1].id, number: 'A-12', rent: 700 },
  { id: '00000000-0000-4000-8300-000000000005', property: properties[2].id, number: '201', rent: 350 },
  { id: '00000000-0000-4000-8300-000000000006', property: properties[2].id, number: '202', rent: 375 },
];
const tenants = [
  { id: '00000000-0000-4000-8400-000000000001', name: 'يوسف محمد الشحي' },
  { id: '00000000-0000-4000-8400-000000000002', name: 'سارة عبدالله الهنائية' },
  { id: '00000000-0000-4000-8400-000000000003', name: 'شركة المدار الحديثة ش.م.م' },
  { id: '00000000-0000-4000-8400-000000000004', name: 'راشد علي المقبالي' },
  { id: '00000000-0000-4000-8400-000000000005', name: 'فاطمة سالم الرواحية' },
];
const plans = [
  { unit: units[0], tenant: tenants[0], paidRatio: 1 },
  { unit: units[1], tenant: tenants[1], paidRatio: 0.5 },
  { unit: units[2], tenant: tenants[2], paidRatio: 1 },
  { unit: units[3], tenant: tenants[3], paidRatio: 0 },
  { unit: units[4], tenant: tenants[4], paidRatio: 0 },
];

function agreementId(index) { return `00000000-0000-4000-8500-00000000000${index + 1}`; }
function versionId(index) { return `00000000-0000-4000-8510-00000000000${index + 1}`; }
function agreementForProperty(propertyId) {
  const index = properties.findIndex((property) => property.id === propertyId);
  if (index < 0) throw new Error(`No pilot agreement for property ${propertyId}.`);
  return agreementId(index);
}

async function ensureCompany() {
  await upsert('companies', { id: COMPANY_ID, name: COMPANY_NAME, slug: 'malek-pilot-demo', is_active: true });
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
      email, password, email_confirm: true,
      app_metadata: { role: 'ADMIN', user_role: 'ADMIN', company_id: COMPANY_ID },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error(`Could not create ${name}.`);
    user = created.data.user;
  } else {
    const updated = await service.auth.admin.updateUserById(user.id, {
      password, email_confirm: true,
      app_metadata: { role: 'ADMIN', user_role: 'ADMIN', company_id: COMPANY_ID },
    });
    if (updated.error || !updated.data.user) throw updated.error ?? new Error(`Could not refresh ${name}.`);
    user = updated.data.user;
  }
  await upsert('users', { id: user.id, email, name, full_name: name, role: 'ADMIN', status: 'ACTIVE', is_active: true, deleted_at: null });
  await upsert('company_members', { company_id: COMPANY_ID, user_id: user.id, role: 'ADMIN', is_active: true }, 'company_id,user_id');
  return user;
}

async function signIn(email, password, label) {
  const client = createClient(env.url, env.anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const signedIn = await client.auth.signInWithPassword({ email, password });
  dataOrThrow(`sign in ${label}`, signedIn);
  const claim = signedIn.data.session?.user?.app_metadata?.company_id ?? signedIn.data.session?.user?.app_metadata?.companyId;
  if (claim !== COMPANY_ID) throw new Error(`${label} is missing the pilot company claim.`);
  return client;
}

async function prepareMasterData(maker, checker) {
  const { start, end } = monthRange();
  await upsert('company_settings', {
    id: '00000000-0000-4000-8000-000000000102', singleton_key: true,
    company_name: COMPANY_NAME, currency: 'OMR', vat_enabled: false, vat_rate: 0, company_id: COMPANY_ID,
  });
  dataOrThrow('provision chart of accounts', await service.rpc('provision_company_chart_of_accounts', { p_company_id: COMPANY_ID }));
  await upsert('company_tax_profiles', {
    id: '00000000-0000-4000-8000-000000000103', company_id: COMPANY_ID, version_no: 1,
    tax_code: 'NON_TAXABLE', tax_rate: 0, effective_from: '2020-01-01', effective_to: '2039-12-31', status: 'ACTIVE',
    description: `${TAG}: non-taxable rent`, created_by: maker.id, approved_by: checker.id, approved_at: new Date().toISOString(),
  });
  await upsert('company_fee_tax_treatments', {
    id: '00000000-0000-4000-8000-000000000104', company_id: COMPANY_ID, fee_kind: 'RATE_MANAGEMENT_FEE', version_no: 1,
    tax_code: 'NON_TAXABLE', tax_rate: 0, effective_from: '2020-01-01', effective_to: '2039-12-31', status: 'ACTIVE',
    created_by: maker.id, approved_by: checker.id, approved_at: new Date().toISOString(),
  });
  await upsert('accounting_periods', {
    id: '00000000-0000-4000-8000-000000000105', company_id: COMPANY_ID,
    name: `Pilot ${start}..${end}`, start_date: start, end_date: end, status: 'OPEN',
  });

  for (const owner of owners) {
    await upsert('owners', { id: owner.id, full_name: owner.full, display_name: owner.display, is_active: true, company_id: COMPANY_ID });
  }
  for (let i = 0; i < properties.length; i += 1) {
    const property = properties[i];
    await upsert('properties', { id: property.id, title: property.title, type: property.type, address: property.address, status: 'active', company_id: COMPANY_ID });
    await upsert('property_owners', {
      id: `00000000-0000-4000-8250-00000000000${i + 1}`, property_id: property.id, owner_id: property.owner,
      ownership_percentage: 100, is_primary: true, starts_on: '2020-01-01', ends_on: '2039-12-31', company_id: COMPANY_ID,
    });
    await upsert('owner_agreements', {
      id: agreementId(i), owner_id: property.owner, property_id: property.id,
      agreement_type: 'property_management', commission_type: 'RATE', commission_value: property.fee,
      starts_on: '2020-01-01', ends_on: '2039-12-31', notes: TAG, company_id: COMPANY_ID,
    });
    dataOrThrow(`retire trigger-created agreement version ${i + 1}`, await service
      .from('owner_agreement_versions')
      .update({ effective_to: '2019-12-31', superseded_at: new Date().toISOString() })
      .eq('owner_agreement_id', agreementId(i))
      .neq('id', versionId(i))
      .is('superseded_at', null));
    await upsert('owner_agreement_versions', {
      id: versionId(i), owner_agreement_id: agreementId(i), company_id: COMPANY_ID, version_no: 2,
      operating_model: 'OWNER_AGENCY', collection_role: 'OWNER_IS_CREDITOR', commission_type: 'RATE', commission_value: property.fee,
      commission_recognition_basis: 'ON_COLLECTION', offset_allowed: false, reserve_amount: 0,
      effective_from: '2020-01-01', effective_to: '2039-12-31', superseded_at: null, created_by: maker.id,
    });
    dataOrThrow(`pin agreement version ${i + 1}`, await service.from('owner_agreements').update({ current_version_id: versionId(i) }).eq('id', agreementId(i)));
  }
  for (const unit of units) {
    await upsert('units', { id: unit.id, property_id: unit.property, unit_number: unit.number, status: 'available', rent_amount: unit.rent, company_id: COMPANY_ID });
  }
  for (const tenant of tenants) {
    await upsert('people', { id: tenant.id, full_name: tenant.name, type: 'tenant', company_id: COMPANY_ID });
  }
}

async function ensureContract(makerClient, checkerClient, plan, index) {
  const existing = dataOrThrow(`find contract ${plan.unit.number}`, await service.from('contracts')
    .select('id').eq('company_id', COMPANY_ID).eq('unit_id', plan.unit.id).eq('tenant_id', plan.tenant.id)
    .eq('notes', `${TAG}:contract:${index + 1}`).is('deleted_at', null).maybeSingle());
  if (existing?.id) return existing.id;

  const created = dataOrThrow(`create contract ${plan.unit.number}`, await makerClient.rpc('create_contract_atomic_v2', {
    p_property_id: plan.unit.property, p_unit_id: plan.unit.id, p_tenant_id: plan.tenant.id,
    p_agreement_id: agreementForProperty(plan.unit.property), p_start_date: monthRange().start, p_end_date: '2030-12-31',
    p_rent_amount: plan.unit.rent, p_payment_cycle: 'monthly', p_payment_terms_id: null, p_status: 'draft',
    p_cancellation_reason: null, p_notes: `${TAG}:contract:${index + 1}`, p_attachment_url: null,
    p_billing_day: 1, p_grace_days: 5, p_lease_mode: 'long_term', p_daily_reference_rate: null,
  }));
  const id = String(created?.id ?? '');
  if (!id) throw new Error(`Contract ${plan.unit.number} returned no id.`);
  dataOrThrow(`submit contract ${plan.unit.number}`, await makerClient.rpc('submit_contract_for_approval_atomic', { p_contract_id: id, p_maker_signature: 'MALEK Pilot Maker' }));
  dataOrThrow(`approve contract ${plan.unit.number}`, await checkerClient.rpc('approve_contract_atomic', { p_contract_id: id, p_checker_signature: 'MALEK Pilot Checker' }));
  dataOrThrow(`activate contract ${plan.unit.number}`, await makerClient.rpc('activate_contract_with_agreement_snapshot_atomic', { p_contract_id: id }));
  return id;
}

async function seedFinancialActivity(makerClient, contractIds) {
  const { today } = monthRange();
  dataOrThrow('generate current invoices', await makerClient.rpc('generate_invoices_from_active_contracts'));
  const invoices = dataOrThrow('load pilot invoices', await service.from('invoices')
    .select('id,contract_id,amount,paid_amount,status,billing_period_start,billing_period_end')
    .in('contract_id', contractIds).is('deleted_at', null)) ?? [];

  for (let i = 0; i < plans.length; i += 1) {
    const candidates = invoices.filter((invoice) => invoice.contract_id === contractIds[i]);
    const invoice = candidates.sort((a, b) => String(b.billing_period_start).localeCompare(String(a.billing_period_start)))[0];
    if (!invoice) throw new Error(`No generated invoice for pilot contract ${contractIds[i]}.`);
    const desired = Number(invoice.amount) * plans[i].paidRatio;
    const remainder = Math.round((desired - Number(invoice.paid_amount ?? 0)) * 1000) / 1000;
    if (remainder > 0.0001) {
      dataOrThrow(`record pilot payment ${i + 1}`, await makerClient.rpc('record_invoice_payment_atomic', { payload: {
        invoice_id: invoice.id, amount: remainder, method: i === 2 ? 'bank_transfer' : 'cash', date: today,
        reference: `PILOT-PAY-${String(i + 1).padStart(2, '0')}`,
        request_id: `00000000-0000-4000-8700-00000000000${i + 1}`,
      } }));
    }
  }

  const expenses = [
    { request_id: '00000000-0000-4000-8800-000000000001', property_id: properties[0].id, category: 'صيانة', amount: 35.5, expense_date: today, charged_to: 'OWNER', description: `${TAG}: صيانة تكييف على حساب المالك` },
    { request_id: '00000000-0000-4000-8800-000000000002', property_id: properties[1].id, category: 'خدمات', amount: 18.75, expense_date: today, charged_to: 'OWNER', description: `${TAG}: خدمة دورية على حساب المالك` },
    { request_id: '00000000-0000-4000-8800-000000000003', property_id: properties[2].id, category: 'تشغيل المكتب', amount: 12, expense_date: today, charged_to: 'COMPANY', description: `${TAG}: مصروف تشغيلي لا يخص المالك` },
  ];
  for (const payload of expenses) {
    dataOrThrow(`create expense ${payload.request_id}`, await makerClient.rpc('create_expense_with_journal_atomic', { p_payload: payload }));
  }
}

async function verify(contractIds) {
  const queries = {
    properties: service.from('properties').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    units: service.from('units').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    owners: service.from('owners').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    tenants: service.from('people').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID).eq('type', 'tenant'),
    contracts: service.from('contracts').select('id', { count: 'exact', head: true }).in('id', contractIds),
    invoices: service.from('invoices').select('id', { count: 'exact', head: true }).in('contract_id', contractIds),
    receipts: service.from('receipts').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
    expenses: service.from('expenses').select('id', { count: 'exact', head: true }).eq('company_id', COMPANY_ID),
  };
  const entries = await Promise.all(Object.entries(queries).map(async ([name, query]) => [name, await query]));
  const counts = {};
  for (const [name, result] of entries) {
    if (result.error) throw new Error(`verify ${name}: ${result.error.message}`);
    counts[name] = result.count ?? 0;
  }
  if (counts.properties < 3 || counts.units < 6 || counts.owners < 3 || counts.contracts < 5 || counts.invoices < 5 || counts.receipts < 2 || counts.expenses < 3) {
    throw new Error(`Pilot dataset is incomplete: ${JSON.stringify(counts)}`);
  }
  console.log(JSON.stringify({
    environment: env.kind, companyId: COMPANY_ID, companyName: COMPANY_NAME, dataset: TAG, counts,
    scenarios: ['تحصيل كامل', 'تحصيل جزئي', 'غير محصل', 'مصروف على المالك', 'مصروف على المكتب', 'Maker/Checker contract approval'],
    productionMutation: false, verifiedAt: new Date().toISOString(),
  }, null, 2));
}

async function main() {
  await ensureCompany();
  const maker = await ensureIdentity(env.email, env.password, 'مدير مكتب مالك التجريبي');
  const checker = await ensureIdentity(env.checkerEmail, env.checkerPassword, 'مراجع مكتب مالك التجريبي');
  await prepareMasterData(maker, checker);
  const makerClient = await signIn(env.email, env.password, 'pilot maker');
  const checkerClient = await signIn(env.checkerEmail, env.checkerPassword, 'pilot checker');
  const contractIds = [];
  for (let i = 0; i < plans.length; i += 1) contractIds.push(await ensureContract(makerClient, checkerClient, plans[i], i));
  await seedFinancialActivity(makerClient, contractIds);
  await verify(contractIds);
}

await main();
