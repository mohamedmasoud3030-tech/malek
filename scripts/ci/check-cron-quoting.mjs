import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = [
  'supabase/migrations/20260718101201_automation_scheduling_and_fixed_exception.sql',
  'supabase/migrations_history/20260718101201_automation_scheduling_and_fixed_exception.sql',
];
const migrationPath = candidates
  .map((rel) => resolve(process.cwd(), rel))
  .find((full) => {
    try {
      readFileSync(full, 'utf8');
      return true;
    } catch {
      return false;
    }
  });
if (!migrationPath) {
  throw new Error('pg_cron quoting contract file is missing from migrations and migrations_history.');
}
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
