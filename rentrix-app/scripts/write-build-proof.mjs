import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Writes the deployment identity artifact published at `/build-proof.json`.
 *
 * It exists so a deployed surface can be tied to an immutable Git revision and
 * to the exact database migration manifest that revision ships. Three values
 * are recorded, and all three are derived — never hand-written:
 *
 *   sha          — the commit the artifact was built from.
 *   builtAt      — UTC build timestamp (ordering evidence, not identity).
 *   schemaDigest — sha256 over the sorted `migration.sql:<sha256(sql)>>` manifest
 *                  of supabase/migrations. Two builds that ship different
 *                  schema files can never share a digest.
 *
 * `rentrix-app/scripts/verify-deployment-identity.mjs` consumes this artifact
 * and fails closed when a deployed surface does not match the reviewed commit.
 * Keep the `sha` field name stable: that file, plus
 * `hosted-staging-preflight.mjs`, both read it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const migrationsDir = join(repoRoot, 'supabase', 'migrations');

const sha = (
  process.env.VERCEL_GIT_COMMIT_SHA
  ?? process.env.GITHUB_HEAD_SHA
  ?? process.env.GITHUB_SHA
  ?? 'local'
).trim();

async function computeSchemaDigest() {
  const entries = (await readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const lines = [];
  for (const name of entries) {
    const content = await readFile(join(migrationsDir, name));
    const fileDigest = createHash('sha256').update(content).digest('hex');
    lines.push(`${name}:${fileDigest}`);
  }
  return {
    schemaDigest: createHash('sha256').update(lines.join('\n')).digest('hex'),
    migrationCount: lines.length,
  };
}

const { schemaDigest, migrationCount } = await computeSchemaDigest();

await writeFile(
  resolve(here, '../public/build-proof.json'),
  `${JSON.stringify({
    sha,
    builtAt: new Date().toISOString(),
    schemaDigest,
    migrationCount,
  }, null, 2)}\n`,
  'utf8',
);
