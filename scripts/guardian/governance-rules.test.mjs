#!/usr/bin/env node
// Scanner regressions for the narrow DG-GOV-003 / DG-GOV-007 / DG-GOV-008
// recognizers. Unsafe negative controls must still fail.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasCanonicalAuthorityResolver,
  isUsersRoleOperationalAuthority,
  shouldRequireAdminManagerResolver,
} from './governance-rules.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(await readFile(join(HERE, 'governance-contract.json'), 'utf8'));
const accepted = contract.dgGov008.acceptedResolverCalls;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${name}`);
    console.log(`        ${error.message}`);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

test('service-only stub does not require is_admin_or_manager body token', () => {
  assert(
    shouldRequireAdminManagerResolver({ anon_execute: false, authenticated_execute: false }) === false,
    'expected service-only stub to skip DG-GOV-003 body check',
  );
});

test('authenticated-callable sensitive function still requires ADMIN/MANAGER resolver', () => {
  assert(
    shouldRequireAdminManagerResolver({ anon_execute: false, authenticated_execute: true }) === true,
    'expected authenticated function to keep DG-GOV-003',
  );
});

test('support-capability actor gate is a canonical resolver', () => {
  const def = "if not public.current_user_has_support_capability('support.user_lookup.view') then raise exception 'x'; end if;";
  assert(hasCanonicalAuthorityResolver(def, accepted), 'expected support capability to count');
});

test('users.role target snapshot is not operational authority when actor is canonically gated', () => {
  const def = `
    if not public.current_user_has_support_capability('support.user_lookup.view') then raise exception 'x'; end if;
    select u.id, u.role::text from public.users u where u.id = p_target;
    if v_target.role = 'ADMIN' then null; end if;
  `;
  assert(
    isUsersRoleOperationalAuthority(def, accepted) === false,
    'expected target-profile users.role read to be ignored when actor is gated',
  );
});

test('users.role remains a finding without a canonical actor resolver', () => {
  const def = `
    select u.role::text from public.users u where u.id = auth.uid();
    if u.role = 'ADMIN' then return true; end if;
  `;
  assert(
    isUsersRoleOperationalAuthority(def, accepted) === true,
    'expected ungated users.role authority to remain a finding',
  );
});

test('auth.uid/require_company_id alone is not a canonical resolver', () => {
  const def = "if auth.uid() is null then raise exception 'x'; end if; perform public.require_company_id();";
  assert(
    hasCanonicalAuthorityResolver(def, accepted) === false,
    'identity/scoping must not satisfy DG-GOV-008',
  );
});

console.log('');
console.log(`Guardian rule regressions: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
