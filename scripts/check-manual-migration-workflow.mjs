import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const path = '.github/workflows/supabase-production-migrations.yml';
const text = readFileSync(path, 'utf8');

function validate(t) {
  assert(/^on:\n  workflow_dispatch:/m.test(t), 'workflow must be dispatch-only');
  assert(!/^\s+(push|pull_request|schedule):/m.test(t), 'automatic trigger detected');
  assert(/environment:\n\s+name: production/.test(t), 'production environment approval missing');
  assert(/name: preflight \/ dry-run/.test(t) && /name: approved migration deploy/.test(t), 'required paths missing');
  assert(/default: preflight/.test(t), 'deploy must not be the default');
  assert(/\^\[0-9a-f\]\{40\}\$/.test(t), 'full SHA validation missing');
  assert((t.match(/git fetch --no-tags origin main/g) || []).length >= 3, 'origin/main must be refreshed before every SHA decision');
  assert((t.match(/git rev-parse HEAD/g) || []).length >= 3, 'SHA must be checked before approval, after approval, and before apply');
  assert((t.match(/git rev-parse origin\/main/g) || []).length >= 3, 'origin/main must match the approved SHA at every gate');
  assert(/git merge-base --is-ancestor/.test(t), 'main ancestry gate missing');
  assert(/APPROVED_SHA: \$\{\{ inputs\.approved_sha \}\}/.test(t), 'approved SHA input missing');
  assert(/supabase link --project-ref/.test(t), 'explicit Supabase project linking missing');
  assert(/supabase migration list --linked/.test(t), 'remote migration evidence missing');
  assert(/supabase db push --linked[^\n]*--dry-run/.test(t), 'approved dry-run missing');
  assert(/supabase db push --linked[^\n]*--yes/.test(t), 'approved deploy command missing');
  assert(/Upload preflight evidence/.test(t) && /Upload deployment evidence/.test(t), 'evidence artifacts missing');

  const preflight = t.slice(t.indexOf('  preflight:'), t.indexOf('  approved-deploy:'));
  assert(!/SUPABASE_(ACCESS_TOKEN|PROJECT_REF|DB_PASSWORD)/.test(preflight), 'preflight must not access Production secrets');
  assert(!/supabase (link|db push|migration list --linked)/.test(preflight), 'preflight must not access or write Production');

  const deploy = t.slice(t.indexOf('  approved-deploy:'));
  assert(/if:.*inputs\.action == 'deploy'/.test(deploy), 'deploy must require explicit action');
  assert((deploy.match(/Re-verify exact SHA/g) || []).length >= 2, 'SHA must be re-verified after approval and immediately before apply');
}

validate(text);

for (const [label, mutate] of [
  ['push trigger', t => t.replace('  workflow_dispatch:', '  push:\n    branches: [main]\n  workflow_dispatch:')],
  ['missing environment', t => t.replace(/environment:\n\s+name: production/, '')],
  ['deploy default', t => t.replace('default: preflight', 'default: deploy')],
  ['missing final SHA check', t => t.replace('Re-verify exact SHA immediately before apply', 'Removed final SHA gate')],
  ['preflight Production write', t => t.replace('Build local migration evidence (no Production access)', 'Build local migration evidence (no Production access)\n        run: pnpm exec supabase db push --linked --yes')],
  ['missing dry-run', t => t.replace(/pnpm exec supabase db push --linked[^\n]*--dry-run[^\n]*/, 'echo dry-run removed')],
  ['missing preflight artifact', t => t.replace(/      - name: Upload preflight evidence[\s\S]*?(?=\n  approved-deploy:)/, '')],
  ['Production secret in preflight', t => t.replace('APPROVED_SHA: ${{ inputs.approved_sha }}', 'APPROVED_SHA: ${{ inputs.approved_sha }}\n          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}')],
]) {
  let failed = false;
  try {
    validate(mutate(text));
  } catch {
    failed = true;
  }
  assert(failed, `${label} regression was not detected`);
}

console.log('manual migration workflow guard: OK (positive + 8 negative cases)');
