import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260718101201_automation_scheduling_and_fixed_exception.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

const requiredFragments = [
  'DO $cron_outer$',
  '$cron_inner$ SELECT public.run_scheduled_automation_rules(); $cron_inner$',
  'END $cron_outer$;',
];

for (const fragment of requiredFragments) {
  if (!sql.includes(fragment)) {
    throw new Error(`pg_cron quoting contract is missing: ${fragment}`);
  }
}

if (sql.includes('$$ SELECT public.run_scheduled_automation_rules()')) {
  throw new Error('pg_cron command must not reuse the surrounding $$ delimiter.');
}

console.log('pg_cron quoting contract: OK');
