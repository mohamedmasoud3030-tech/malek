import { describe, expect, it } from 'vitest';
import { createReplayedDatabase } from './replay-bootstrap';

const COMPANY_A = 'ca000000-0000-4000-8000-00000000000a';
const COMPANY_B = 'cb000000-0000-4000-8000-00000000000b';
const ADMIN_A = 'aa000000-0000-4000-8000-000000000001';
const MANAGER_B = 'bb000000-0000-4000-8000-000000000002';
const USER_NC = 'cc000000-0000-4000-8000-000000000009'; // app user, NO company membership
const OWNER_A = '0a000000-0000-4000-8000-00000000000a';
const OWNER_B = '0b000000-0000-4000-8000-00000000000b';
const PROPERTY_A = '1a000000-0000-4000-8000-00000000000a';
const PROPERTY_B = '1b000000-0000-4000-8000-00000000000b';
const TENANT_A = '2a000000-0000-4000-8000-00000000000a';
const TENANT_B = '2b000000-0000-4000-8000-00000000000b';
const UNIT_A = '3a000000-0000-4000-8000-00000000000a';
const UNIT_B = '3b000000-0000-4000-8000-00000000000b';
const CONTRACT_A = '4a000000-0000-4000-8000-00000000000a';
const CONTRACT_B = '4b000000-0000-4000-8000-00000000000b';
const INVOICE_A = '5a000000-0000-4000-8000-00000000000a';
const INVOICE_B = '5b000000-0000-4000-8000-00000000000b';
const RECEIPT_A = '6a000000-0000-4000-8000-00000000000a';
const RECEIPT_B = '6b000000-0000-4000-8000-00000000000b';
const PAYMENT_A = '9d000000-0000-4000-8000-00000000000a';
const PAYMENT_B = '9d000000-0000-4000-8000-00000000000b';
const AGREEMENT_A = '7a000000-0000-4000-8000-00000000000a';
const AGREEMENT_B = '7b000000-0000-4000-8000-00000000000b';

describe('pymt id probe', () => {
  it('pins payments.id type and real rows', async () => {
    const { db } = await createReplayedDatabase();
    const t = (await db.query(`SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='payments' AND column_name='id'`)).rows;
    console.log('payments.id type:', JSON.stringify(t));
    await db.exec(`
INSERT INTO public.companies (id, name, slug) VALUES ('${COMPANY_A}','شركة ألف','alpha'),('${COMPANY_B}','شركة باء','beta');
INSERT INTO auth.users (id, email) VALUES ('${ADMIN_A}','admin.a@p0.test'),('${MANAGER_B}','manager.b@p0.test'),('${USER_NC}','no.company@p0.test');
INSERT INTO public.users (id, email, name, role, status) VALUES
  ('${ADMIN_A}','admin.a@p0.test','مدير أ','ADMIN','ACTIVE'),
  ('${MANAGER_B}','manager.b@p0.test','مشرف ب','MANAGER','ACTIVE'),
  ('${USER_NC}','no.company@p0.test','بلا شركة','ADMIN','ACTIVE');
INSERT INTO public.company_members (company_id, user_id, role) VALUES
  ('${COMPANY_A}','${ADMIN_A}','ADMIN'),('${COMPANY_B}','${MANAGER_B}','ADMIN');
INSERT INTO public.owners (id, full_name, name, company_id) VALUES
  ('${OWNER_A}','مالك ألف','مالك ألف','${COMPANY_A}'),('${OWNER_B}','مالك باء','مالك باء','${COMPANY_B}');
INSERT INTO public.properties (id, title, name, type, address, company_id) VALUES
  ('${PROPERTY_A}','عقار ألف','عقار ألف','سكني','مسقط','${COMPANY_A}'),('${PROPERTY_B}','عقار باء','عقار باء','سكني','مسقط','${COMPANY_B}');
INSERT INTO public.property_owners (property_id, owner_id, ownership_percentage, is_primary, company_id) VALUES
  ('${PROPERTY_A}','${OWNER_A}',100,true,'${COMPANY_A}'),('${PROPERTY_B}','${OWNER_B}',100,true,'${COMPANY_B}');
INSERT INTO public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on) VALUES
  ('${AGREEMENT_A}','${OWNER_A}','${PROPERTY_A}','property_management','RATE',10,'2026-01-01'),
  ('${AGREEMENT_B}','${OWNER_B}','${PROPERTY_B}','property_management','RATE',10,'2026-01-01');
INSERT INTO public.units (id, property_id, unit_number, company_id) VALUES
  ('${UNIT_A}','${PROPERTY_A}','A-1','${COMPANY_A}'),('${UNIT_B}','${PROPERTY_B}','B-1','${COMPANY_B}');
INSERT INTO public.people (id, full_name, type, company_id) VALUES
  ('${TENANT_A}','مستأجر ألف','tenant','${COMPANY_A}'),('${TENANT_B}','مستأجر باء','tenant','${COMPANY_B}');
INSERT INTO public.contracts (id, property_id, unit_id, tenant_id, start_date, end_date, rent_amount, status, agreement_id, company_id) VALUES
  ('${CONTRACT_A}','${PROPERTY_A}','${UNIT_A}','${TENANT_A}','2026-01-01','2026-12-31',12000,'active','${AGREEMENT_A}','${COMPANY_A}'),
  ('${CONTRACT_B}','${PROPERTY_B}','${UNIT_B}','${TENANT_B}','2026-01-01','2026-12-31',24000,'active','${AGREEMENT_B}','${COMPANY_B}');
INSERT INTO public.invoices (id, contract_id, issue_date, due_date, amount, paid_amount, tax_amount, status, company_id) VALUES
  ('${INVOICE_A}','${CONTRACT_A}','2026-07-01','2026-07-31',1000,0,0,'UNPAID','${COMPANY_A}'),
  ('${INVOICE_B}','${CONTRACT_B}','2026-07-01','2026-07-31',6000,0,0,'UNPAID','${COMPANY_B}');
INSERT INTO public.receipts (id, amount, status, company_id) VALUES ('${RECEIPT_A}',1000,'POSTED','${COMPANY_A}'),('${RECEIPT_B}',6000,'POSTED','${COMPANY_B}');
INSERT INTO public.payments (id, invoice_id, contract_id, amount, payment_method, payment_date, status, receipt_id, company_id) VALUES
  ('${PAYMENT_A}','${INVOICE_A}','${CONTRACT_A}',1000,'cash','2026-07-15','POSTED','${RECEIPT_A}','${COMPANY_A}'),
  ('${PAYMENT_B}','${INVOICE_B}','${CONTRACT_B}',6000,'cash','2026-07-15','POSTED','${RECEIPT_B}','${COMPANY_B}');
INSERT INTO public.expenses (id, property_id, category, amount, expense_date, status, charged_to, company_id) VALUES
  ('8a000000-0000-4000-8000-00000000000a','${PROPERTY_A}','maintenance',200,'2026-07-20','POSTED','owner','${COMPANY_A}'),
  ('8b000000-0000-4000-8000-00000000000b','${PROPERTY_B}','maintenance',900,'2026-07-20','POSTED','owner','${COMPANY_B}');
  
  `);
    const superRows = (await db.query(`SELECT id::text AS id, company_id::text AS c FROM public.payments`)).rows;
    console.log('superuser rows:', JSON.stringify(superRows));
    await db.exec(`SELECT set_config('request.jwt.claims', '{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"company_id":"ca000000-0000-4000-8000-00000000000a"}}', false);`);
    await db.exec('SET ROLE authenticated;');
    const asA = (await db.query(`SELECT id::text AS id, company_id::text AS c FROM public.payments`)).rows;
    console.log('as A rows:', JSON.stringify(asA));
    const byId = (await db.query(`SELECT count(*)::int AS n FROM public.payments WHERE id = '9d000000-0000-4000-8000-00000000000b'`)).rows;
    console.log('as A byId:', JSON.stringify(byId));
    const byIdText = (await db.query(`SELECT count(*)::int AS n FROM public.payments WHERE id::text = '9d000000-0000-4000-8000-00000000000b'`)).rows;
    console.log('as A byIdText:', JSON.stringify(byIdText));
    expect(true).toBe(true);
  }, 600_000);
});
