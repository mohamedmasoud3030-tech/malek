#!/usr/bin/env node
/**
 * Workflow honesty guard.
 *
 * A check whose name promises release blocking, and which then echoes a
 * sentence and exits zero, is worse than no check: it manufactures confidence.
 * Three such jobs existed in `release-blocker-gate.yml` and a fourth in
 * `browser-readiness.yml`. They were removed; this guard makes sure they
 * cannot come back, in any workflow.
 *
 * Rules enforced:
 *   1. No job may consist solely of `echo` / `true` / `:` / `exit 0`. A job
 *      must execute at least one real command.
 *   2. No `run:` step may be a pure announcement whose text admits it is doing
 *      no work ("deferred", "manual", "nothing to do", "skipped by design")
 *      without also failing or exiting non-zero — deferral must be expressed
 *      by `if:` on a job that actually exists, not by a green placeholder.
 *   3. A job whose `if:` makes it unreachable for the workflow's own trigger
 *      set is reported: a gate that can never run is not a gate.
 *
 * Reads every workflow under .github/workflows/. Exits non-zero with a precise
 * file/job/step on any violation.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * `--root <dir>` lets the self-test point the guard at a fixture tree; without
 * it the guard inspects the repository it ships in.
 */
const rootFlagIndex = process.argv.indexOf('--root');
const repoRoot = rootFlagIndex === -1
  ? resolve(import.meta.dirname, '..')
  : resolve(process.argv[rootFlagIndex + 1]);
const workflowDir = join(repoRoot, '.github', 'workflows');

/** Commands that do no verification work. */
const INERT_COMMAND = /^(echo|true|:|exit\s+0)\b/;

/** Text that admits the step is not doing the work it is named for. */
const DEFERRAL_ADMISSION =
  /\b(defer|deferred|deferring|nothing to do|no-op|noop|not run|does not run|manual(?:ly)? (?:during|only)|skipped by design|placeholder|for now)\b/i;

function listWorkflows() {
  return readdirSync(workflowDir)
    .filter((name) => name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();
}

/**
 * Minimal, dependency-free YAML-indent reader. GitHub workflow files in this
 * repository are consistently 2-space indented, which is all this needs.
 */
function parseJobs(text) {
  const lines = text.split('\n');
  const jobsStart = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (jobsStart === -1) return [];

  const jobs = [];
  let current = null;

  for (let index = jobsStart + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\S/.test(line) && line.trim() !== '') break; // left the jobs block
    const jobMatch = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (jobMatch) {
      current = { name: jobMatch[1], ifExpression: null, steps: [] };
      jobs.push(current);
      continue;
    }
    if (!current) continue;

    const jobIf = /^ {4}if:\s*(.+)$/.exec(line);
    if (jobIf) current.ifExpression = jobIf[1].trim();

    const stepName = /^\s{6,}-\s+name:\s*(.+)$/.exec(line);
    if (stepName) {
      // Strip surrounding quotes for readability in messages.
      current.steps.push({ name: stepName[1].trim().replace(/^['"]|['"]$/g, ''), run: [] });
      continue;
    }
    // A run: block or inline run: value belonging to the most recent step.
    if (current.steps.length === 0) continue;
    const inlineRun = /^\s{8,}run:\s*(.+)$/.exec(line);
    if (inlineRun) {
      current.steps[current.steps.length - 1].run.push(inlineRun[1].trim());
      continue;
    }
    if (/^\s{8,}run:\s*[|>]?\s*$/.test(line)) {
      // Block scalar; capture indented body lines until dedent.
      const target = current.steps[current.steps.length - 1];
      let j = index + 1;
      while (j < lines.length && (lines[j].trim() === '' || /^\s{10,}/.test(lines[j]))) {
        if (lines[j].trim() !== '') target.run.push(lines[j].trim());
        j += 1;
      }
    }
  }
  return jobs;
}

const violations = [];
const notes = [];

for (const file of listWorkflows()) {
  const path = join(workflowDir, file);
  const text = readFileSync(path, 'utf8');
  const display = relative(repoRoot, path).split('\\').join('/');
  const jobs = parseJobs(text);

  for (const job of jobs) {
    const runnable = job.steps.flatMap((step) => step.run.map((command) => ({ step: step.name, command })));
    if (runnable.length === 0) continue; // jobs that only use `uses:` are fine

    const realCommands = runnable.filter(({ command }) => !INERT_COMMAND.test(command));
    if (realCommands.length === 0) {
      violations.push(
        `${display}: job "${job.name}" executes no real command `
        + `(only ${runnable.map(({ command }) => `\`${command}\``).join(', ')}). `
        + 'An inert job must not exist: express deferral with `if:` on a job that does real work.',
      );
      continue;
    }

    for (const { step, command } of runnable) {
      if (DEFERRAL_ADMISSION.test(command) && INERT_COMMAND.test(command)) {
        violations.push(
          `${display}: job "${job.name}" step "${step}" announces it is not doing the work `
          + 'it is named for, yet still exits successfully.',
        );
      }
    }

    // A job guarded to be unreachable is not a gate.
    if (job.ifExpression && /\bfalse\b/i.test(job.ifExpression) && !/inputs\.|github\.|env\./.test(job.ifExpression)) {
      notes.push(`${display}: job "${job.name}" has a constant-false condition.`);
    }
  }
}

if (notes.length > 0) {
  console.log('Workflow honesty notes (not failures):');
  for (const note of notes) console.log(`  - ${note}`);
}

if (violations.length > 0) {
  console.error('Workflow honesty guard FAILED:\n');
  for (const violation of violations) console.error(`  - ${violation}`);
  console.error(`\n${violations.length} violation(s). A green check must mean the named work ran.`);
  process.exit(1);
}

console.log(`Workflow honesty guard passed for ${listWorkflows().length} workflow file(s).`);
