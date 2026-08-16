import { createDatabase, replay } from '../db0/lib/replay.mjs';

const COMPANY_ID = '00000000-0000-4000-a000-000000000002';
const ADMIN_ID = '00000000-0000-4000-8000-000000000001';
const USER_ID = '00000000-0000-4000-8000-000000000002';

async function main() {
  console.log('Starting PGlite DB0 migration replay for Sole Admin Exception verification...');
  const db = await createDatabase();
  const { failures } = await replay(db, { stopOnError: false });
  if (failures.length) {
    console.error('Migration replay failed:');
    for (const f of failures) console.error(`  ${f.file}: ${f.error}`);
    process.exit(1);
  }
  console.log('Migration replay clean. Replayed 259 migrations.');

  // Create Company B
  await db.query(
    `insert into public.companies (id, name, slug, currency, is_active)
     values ($1, 'Demo Malek Co B', 'demo-malek-co-b', 'OMR', true)`,
    [COMPANY_ID]
  );

  // Provision accounts and settings
  await db.query('select public.provision_company_chart_of_accounts($1)', [COMPANY_ID]);

  // Update existing company_settings row to belong to Company B and set sole-admin to false
  await db.query(
    `update public.company_settings set company_id = $1, allow_sole_admin_self_approval = false`,
    [COMPANY_ID]
  );

  // Insert auth users
  await db.query(
    `insert into auth.users (id, email) values
     ($1, 'admin@example.com'),
     ($2, 'user@example.com')`,
    [ADMIN_ID, USER_ID]
  );

  // Add ADMIN and USER users
  await db.query(
    `insert into public.users (id, email, name, role, status) values
     ($1, 'admin@example.com', 'Admin User', 'ADMIN', 'ACTIVE'),
     ($2, 'user@example.com', 'User User', 'USER', 'ACTIVE')`,
    [ADMIN_ID, USER_ID]
  );

  const usersCheck = await db.query(`select * from public.users`);
  console.log('Seeded users rows:', usersCheck.rows);

  // Verify direct update of allow_sole_admin_self_approval is blocked (write boundary check)
  console.log('Testing write boundary: direct UPDATE of allow_sole_admin_self_approval without RPC context...');
  let directUpdateError = null;
  try {
    await db.query(
      `update public.company_settings set allow_sole_admin_self_approval = true where company_id = $1`,
      [COMPANY_ID]
    );
  } catch (err) {
    directUpdateError = err;
  }
  if (directUpdateError && String(directUpdateError).includes('SOLE_ADMIN_SETTING_DIRECT_WRITE_PROHIBITED')) {
    console.log('  PASS - direct UPDATE blocked successfully.');
  } else {
    console.error('  FAIL - direct UPDATE was not blocked! Error:', directUpdateError);
    process.exit(1);
  }

  // Set setting to ON using RPC as ADMIN
  console.log('Testing set_sole_admin_self_approval_atomic enabling as ADMIN...');
  // Mock auth uid
  await db.query(`SELECT set_config('request.jwt.claims', $1, false);`, [JSON.stringify({ sub: ADMIN_ID, role: 'authenticated', app_metadata: { company_id: COMPANY_ID } })]);

  const resEnable = await db.query(
    `select public.set_sole_admin_self_approval_atomic($1::jsonb) as out`,
    [JSON.stringify({ enabled: true, reason: 'Test enabling sole admin self approval', request_id: 'req-enable-1' })]
  );
  console.log('  Setting enabled:', resEnable.rows[0].out);

  // Check audit log
  const auditLogs = await db.query(`select * from public.audit_log order by created_at desc limit 1`);
  if (auditLogs.rows.length && auditLogs.rows[0].action === 'COMPANY_SETTING_CHANGE') {
    console.log('  PASS - Audit log entry created successfully:', auditLogs.rows[0].note);
  } else {
    console.error('  FAIL - Audit log was not created! Got:', auditLogs.rows);
    process.exit(1);
  }

  // Test set_sole_admin_self_approval_atomic as non-ADMIN USER (should fail)
  console.log('Testing set_sole_admin_self_approval_atomic management as non-ADMIN USER...');
  await db.query(`SELECT set_config('request.jwt.claims', $1, false);`, [JSON.stringify({ sub: USER_ID, role: 'authenticated', app_metadata: { company_id: COMPANY_ID } })]);
  let userError = null;
  try {
    await db.query(
      `select public.set_sole_admin_self_approval_atomic($1::jsonb)`,
      [JSON.stringify({ enabled: true, reason: 'Unauthorized edit', request_id: 'req-fail-user' })]
    );
  } catch (err) {
    userError = err;
  }
  if (userError && String(userError).includes('SOLE_ADMIN_SETTING_FORBIDDEN')) {
    console.log('  PASS - unauthorized non-ADMIN manage blocked successfully.');
  } else {
    console.error('  FAIL - unauthorized manage was not blocked! Error:', userError);
    process.exit(1);
  }

  // Seed contract to test same-actor approval
  const OWNER_ID = '00000000-0000-4000-8000-000000000003';
  const PROPERTY_ID = '00000000-0000-4000-8000-000000000004';
  const UNIT_ID = '00000000-0000-4000-8000-000000000005';
  const TENANT_ID = '00000000-0000-4000-8000-000000000006';
  const AGREEMENT_ID = '00000000-0000-4000-8000-000000000007';
  const CONTRACT_ID = '00000000-0000-4000-8000-000000000008';

  await db.query(`insert into public.owners (id, full_name, company_id) values ($1, 'Owner B', $2)`, [OWNER_ID, COMPANY_ID]);
  await db.query(`insert into public.properties (id, title, type, address, owner_id, company_id) values ($1, 'Prop B', 'residential', 'Sohar', $2, $3)`, [PROPERTY_ID, OWNER_ID, COMPANY_ID]);
  await db.query(`insert into public.units (id, property_id, unit_number, company_id) values ($1, $2, 'B-02', $3)`, [UNIT_ID, PROPERTY_ID, COMPANY_ID]);
  await db.query(`insert into public.people (id, full_name, type, company_id) values ($1, 'Tenant B', 'tenant', $2)`, [TENANT_ID, COMPANY_ID]);
  await db.query(`insert into public.property_owners (property_id, owner_id, ownership_percentage, is_primary, company_id) values ($1, $2, 100, true, $3)`, [PROPERTY_ID, OWNER_ID, COMPANY_ID]);
  await db.query(`insert into public.owner_agreements (id, owner_id, property_id, agreement_type, commission_type, commission_value, starts_on, company_id) values ($1, $2, $3, 'property_management', 'RATE', 10, date '2026-01-01', $4)`, [AGREEMENT_ID, OWNER_ID, PROPERTY_ID, COMPANY_ID]);
  
  // Create contract as ADMIN (maker)
  await db.query(`SELECT set_config('request.jwt.claims', $1, false);`, [JSON.stringify({ sub: ADMIN_ID, role: 'authenticated', app_metadata: { company_id: COMPANY_ID } })]);
  await db.query(
    `insert into public.contracts (id, property_id, unit_id, tenant_id, agreement_id, start_date, end_date, rent_amount, status, company_id, maker_user_id, maker_signature, approval_status)
     values ($1, $2, $3, $4, $5, date '2026-08-01', date '2026-08-31', 500.000, 'draft', $6, $7, 'Admin Signature', 'PENDING')`,
    [CONTRACT_ID, PROPERTY_ID, UNIT_ID, TENANT_ID, AGREEMENT_ID, COMPANY_ID, ADMIN_ID]
  );

  // Test same-actor contract approval (should pass because setting is ON)
  console.log('Testing same-actor contract approval with sole-admin exception ON...');
  const resApprove = await db.query(
    `select public.approve_contract_atomic($1, $2) as out`,
    [CONTRACT_ID, 'Admin Checker Signature']
  );
  if (resApprove.rows[0].out.is_sole_admin_exception === true) {
    console.log('  PASS - same-actor approval allowed and is_sole_admin_exception flag set.');
  } else {
    console.error('  FAIL - same-actor approval failed or flag not set! Out:', resApprove.rows[0].out);
    process.exit(1);
  }

  // Turn setting OFF using RPC
  console.log('Testing set_sole_admin_self_approval_atomic disabling...');
  await db.query(`SELECT set_config('request.jwt.claims', $1, false);`, [JSON.stringify({ sub: ADMIN_ID, role: 'authenticated', app_metadata: { company_id: COMPANY_ID } })]);
  await db.query(
    `select public.set_sole_admin_self_approval_atomic($1::jsonb)`,
    [JSON.stringify({ enabled: false, reason: 'Test disabling sole admin self approval', request_id: 'req-disable-1' })]
  );

  // Reset contract to draft/pending
  await db.query(
    `update public.contracts set approval_status = 'PENDING', checker_user_id = null, checker_signature = null, is_sole_admin_exception = false where id = $1`,
    [CONTRACT_ID]
  );

  // Test same-actor approval (should FAIL because setting is OFF)
  console.log('Testing same-actor contract approval with sole-admin exception OFF...');
  let approvalError = null;
  try {
    await db.query(
      `select public.approve_contract_atomic($1, $2)`,
      [CONTRACT_ID, 'Admin Checker Signature']
    );
  } catch (err) {
    approvalError = err;
  }
  if (approvalError && String(approvalError).includes('MAKER_CHECKER_MUST_BE_DISTINCT')) {
    console.log('  PASS - same-actor approval blocked successfully when setting is OFF.');
  } else {
    console.error('  FAIL - same-actor approval was not blocked when setting is OFF! Error:', approvalError);
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log('SOLE ADMIN EXCEPTION END-TO-END VERIFICATION: SUCCESS');
  console.log('======================================================================');

  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
