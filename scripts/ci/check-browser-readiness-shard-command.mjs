import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workflowPath = resolve('.github/workflows/browser-readiness.yml');
const workflow = readFileSync(workflowPath, 'utf8');
const expectedCommand = 'run: pnpm e2e --project=${{ matrix.project }}';
const brokenCommand = 'run: pnpm e2e -- --project=${{ matrix.project }}';

if (!workflow.includes(expectedCommand)) {
  throw new Error(`Browser Readiness must use: ${expectedCommand}`);
}

if (workflow.includes(brokenCommand)) {
  throw new Error('Browser Readiness must not pass the project selector after a double-dash.');
}

console.log('Browser Readiness passes one project selector to Playwright per shard.');
