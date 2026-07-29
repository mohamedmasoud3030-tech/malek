import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const path = '.github/workflows/supabase-production-migrations.yml';
const text = readFileSync(path, 'utf8');
const section = (source, name, next) => source.slice(source.indexOf(`  ${name}:`), next ? source.indexOf(`  ${next}:`) : undefined);

function validate(t) {
  assert(/^on:\n  workflow_dispatch:/m.test(t), 'workflow must be dispatch-only');
  assert(!/^\s+(push|pull_request|schedule):/m.test(t), 'automatic trigger detected');
  assert(/permissions:\n\s+contents: read\n\s+actions: read/.test(t), 'required read permissions missing');
  assert(/concurrency:\n\s+group: production-migrations\n\s+cancel-in-progress: false/.test(t), 'serialized production concurrency missing');
  assert(/options: \[local-preflight, production-inspect, deploy\]/.test(t), 'three explicit actions missing');
  const inputs = t.slice(t.indexOf('    inputs:'), t.indexOf('permissions:'));
  for (const input of ['inspection_run_id', 'backup_reference', 'rollback_plan_reference']) {
    assert(new RegExp(`^\\s{6}${input}:`, 'm').test(inputs), `${input} deploy input missing`);
  }
  for (const job of ['local-preflight', 'production-inspect', 'deploy']) assert(t.includes(`  ${job}:`), `${job} job missing`);
  assert((t.match(/environment: \{ name: production \}/g) || []).length === 2, 'only inspect and deploy may use production environment');

  const local = section(t, 'local-preflight', 'production-inspect');
  const inspect = section(t, 'production-inspect', 'deploy');
  const deploy = section(t, 'deploy');
  assert(!/SUPABASE_|migration list --linked|db push --linked|supabase link/.test(local), 'local preflight must not access Production');
  assert(/supabase migration list --linked/.test(inspect), 'inspect ledger missing');
  assert(/db push --linked[^\n]*--dry-run/.test(inspect), 'inspect dry-run missing');
  assert(!/db push --linked[^\n]*--yes/.test(inspect), 'inspect must not apply');
  assert(/production-inspect-\$\{\{ github.run_id \}\}/.test(inspect), 'inspect artifact missing');
  assert(/inputs\.inspection_run_id/.test(deploy), 'deploy must depend on inspection run id');
  assert(/actions\/download-artifact/.test(deploy), 'deploy must download inspection artifact');
  assert(/action=production-inspect/.test(deploy), 'deploy must reject non-inspection artifact');
  assert(/backup_reference/.test(deploy) && /rollback_plan_reference/.test(deploy), 'deploy recovery evidence missing');
  assert(/db push --linked[^\n]*--yes/.test(deploy), 'deploy apply missing');
  assert((deploy.match(/git fetch --no-tags origin main/g) || []).length >= 2, 'deploy SHA gates missing');
}

validate(text);
for (const [label, mutate] of [
  ['automatic trigger', t => t.replace('  workflow_dispatch:', '  push:\n    branches: [main]\n  workflow_dispatch:')],
  ['inspect apply', t => t.replace('production-inspect-${{ github.run_id }}', 'production-inspect-${{ github.run_id }}\n          # db push --linked --yes')],
  ['missing inspection dependency', t => t.replaceAll('inputs.inspection_run_id', 'inputs.removed')],
  ['missing backup input', t => t.replace('backup_reference:', 'removed_backup_reference:')],
  ['missing concurrency', t => t.replace(/concurrency:[\s\S]*?\nenv:/, 'env:')],
]) {
  let failed = false;
  try { validate(mutate(text)); } catch { failed = true; }
  assert(failed, `${label} regression was not detected`);
}
console.log('manual migration workflow guard: OK');
