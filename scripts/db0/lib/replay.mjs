// WP-DB0 — migration replay engine (PGlite / real PostgreSQL 18 in WASM).
//
// Replays the repository migration chain from an empty database on top of a
// Supabase platform preamble, so that "what the repo actually builds" becomes
// an inspectable artifact instead of an assumption.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { citext } from '@electric-sql/pglite/contrib/citext';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..', '..');
export const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');
export const BOOTSTRAP_SQL = join(HERE, '..', 'bootstrap.sql');

const MIGRATION_NAME = /^\d{14}_.+\.sql$/;

export async function listMigrations() {
  const entries = await readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && MIGRATION_NAME.test(e.name))
    .map((e) => e.name)
    .sort();
}

/**
 * Statements the Supabase platform provides but PGlite cannot execute.
 * These are neutralised, never silently skipped: each rewrite is recorded and
 * reported so the audit can never mistake a local-only shim for real coverage.
 */
const PLATFORM_SHIMS = [
  {
    id: 'pg_cron',
    // pg_cron is a managed extension; scheduling is not part of the schema
    // contract under audit. Migrations already wrap it in exception handlers.
    test: (sql) => /pg_cron|cron\.(schedule|unschedule)/i.test(sql),
  },
];

export function detectPlatformShims(sql) {
  return PLATFORM_SHIMS.filter((s) => s.test(sql)).map((s) => s.id);
}

export async function createDatabase() {
  const db = await PGlite.create({
    extensions: { pgcrypto, btree_gist, citext },
  });

  // Supabase installs extensions into `extensions`; PGlite's contrib bundles
  // install into the current schema, so create them there and alias.
  await db.exec(`create schema if not exists extensions;`);
  for (const ext of ['pgcrypto', 'btree_gist', 'citext']) {
    await db.exec(`create extension if not exists ${ext} with schema extensions;`);
  }
  // Make extension functions resolvable the way they are on Supabase.
  await db.exec(`alter database postgres set search_path to public, extensions;`);
  await db.exec(`set search_path to public, extensions;`);

  const bootstrap = await readFile(BOOTSTRAP_SQL, 'utf8');
  await db.exec(bootstrap);

  // Migration ledger, exactly as the Supabase CLI maintains it.
  await db.exec(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);

  return db;
}

/**
 * Replay the migration chain.
 * @returns {Promise<{applied: string[], failures: Array<{file:string,error:string,detail?:string}>, shimmed: Array<{file:string,shims:string[]}>}>}
 */
export async function replay(db, { files, stopOnError = true, onProgress } = {}) {
  const list = files ?? (await listMigrations());
  const applied = [];
  const failures = [];
  const shimmed = [];

  for (const file of list) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
    const shims = detectPlatformShims(sql);
    if (shims.length) shimmed.push({ file, shims });

    try {
      await db.exec(sql);
      await db.query(
        `insert into supabase_migrations.schema_migrations (version, name)
         values ($1, $2) on conflict (version) do nothing`,
        [file.slice(0, 14), file],
      );
      applied.push(file);
      onProgress?.({ file, ok: true });
    } catch (error) {
      const record = {
        file,
        error: String(error?.message ?? error).split('\n')[0],
        detail: error?.detail ?? undefined,
        hint: error?.hint ?? undefined,
      };
      failures.push(record);
      onProgress?.({ file, ok: false, error: record.error });
      // A failed `exec` may leave an aborted transaction open.
      try {
        await db.exec('rollback;');
      } catch {
        /* no open transaction */
      }
      if (stopOnError) break;
    }
  }

  return { applied, failures, shimmed };
}
