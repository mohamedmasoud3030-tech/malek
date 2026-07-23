import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createReplayedDatabase, evidenceDir } from './replay-bootstrap';

describe('p0 auth privilege probe', () => {
  it('pins exact auth-schema privilege state under role authenticated', async () => {
    const { db } = await createReplayedDatabase();
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('aa000000-0000-4000-8000-000000000001','a@x.test');`);
    await db.exec(`SELECT set_config('request.jwt.claims', '{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated","app_metadata":{"company_id":"ca000000-0000-4000-8000-00000000000a"}}', false);`);
    const out: Record<string, unknown> = {};
    out.has_schema_usage_super = (await db.query(`SELECT has_schema_privilege('authenticated','auth','USAGE') AS v`)).rows[0];
    out.has_jwt_exec = (await db.query(`SELECT has_function_privilege('authenticated','auth.jwt()','EXECUTE') AS v`)).rows[0];
    out.has_uid_exec = (await db.query(`SELECT has_function_privilege('authenticated','auth.uid()','EXECUTE') AS v`)).rows[0];
    await db.exec('SET ROLE authenticated;');
    const tryQ = async (label: string, sql: string) => {
      try { out[label] = { ok: ((await db.query(sql)).rows[0] as any)?.v ?? true }; }
      catch (e) { out[label] = { error: String(e).slice(0, 120) }; }
    };
    await tryQ('direct_auth_jwt', `SELECT (auth.jwt() -> 'app_metadata' ->> 'company_id') AS v`);
    await tryQ('direct_auth_uid', `SELECT auth.uid() AS v`);
    await tryQ('direct_current_company_id', `SELECT public.current_company_id() AS v`);
    await tryQ('has_schema_usage_as_role', `SELECT has_schema_privilege(current_user,'auth','USAGE') AS v`);
    await db.exec('RESET ROLE;');
    writeFileSync(join(evidenceDir, 'cause', 'auth-privilege-state.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    expect(true).toBe(true);
  }, 600_000);
});
