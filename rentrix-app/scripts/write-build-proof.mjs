import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const sha = (
  process.env.VERCEL_GIT_COMMIT_SHA
  ?? process.env.GITHUB_HEAD_SHA
  ?? process.env.GITHUB_SHA
  ?? 'local'
).trim();

await writeFile(
  resolve(here, '../public/build-proof.json'),
  `${JSON.stringify({ sha })}\n`,
  'utf8',
);
