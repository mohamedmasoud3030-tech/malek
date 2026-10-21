#!/usr/bin/env node
/**
 * MALEK — release snapshot builder.
 *
 * Produces a reproducible, verifiable snapshot of the repository: a checksum manifest over every
 * tracked file, a machine-readable release record, a human release note, and an optional source
 * archive.
 *
 * Design rule: this script does not decide whether the project is good. It refuses to produce a
 * release unless independent verification artifacts already exist **at the same commit**:
 *
 *   .gate/last-run.json      written by `pnpm gate:local`
 *   .gate/live-evidence.json written by `pnpm evidence:live`
 *
 * If either is missing, failed, or belongs to another SHA, the build stops. That makes it impossible
 * to ship a snapshot whose evidence was borrowed from a different tree — the exact failure mode that
 * REL-001 forbids.
 *
 * Usage:
 *   node scripts/release/build-release.mjs --version v1.0.0-rc.1
 *   node scripts/release/build-release.mjs --version v1.0.0-rc.1 --archive
 *   node scripts/release/build-release.mjs --version v1.0.0-rc.1 --check   # verify only
 *
 * Exit codes: 0 = ok, 1 = verification missing/stale/failed, 2 = usage or environment error.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const GATE_ARTIFACT = '.gate/last-run.json';
const EVIDENCE_ARTIFACT = '.gate/live-evidence.json';

function parseArgs(argv) {
  const options = { version: null, archive: false, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--version') options.version = argv[++i];
    else if (arg === '--archive') options.archive = true;
    else if (arg === '--check') options.check = true;
    else {
      console.error(`Unknown argument: ${arg}`);
      console.error('Usage: build-release.mjs --version <vX.Y.Z-rc.N> [--archive] [--check]');
      process.exit(2);
    }
  }
  if (!options.version) {
    console.error('--version is required, e.g. --version v1.0.0-rc.1');
    process.exit(2);
  }
  if (!/^v\d+\.\d+\.\d+(-[a-z]+\.\d+)?$/.test(options.version)) {
    console.error(`Version must look like v1.2.3 or v1.2.3-rc.1, got: ${options.version}`);
    process.exit(2);
  }
  return options;
}

function git(args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    console.error(`git ${args.join(' ')} failed: ${result.stderr?.trim()}`);
    process.exit(2);
  }
  return result.stdout;
}

function readJson(path) {
  if (!existsSync(resolve(ROOT, path))) return null;
  try {
    return JSON.parse(readFileSync(resolve(ROOT, path), 'utf8'));
  } catch {
    return null;
  }
}

const options = parseArgs(process.argv.slice(2));
const headSha = git(['rev-parse', 'HEAD']).trim();
const shortSha = headSha.slice(0, 12);
const releaseDir = `docs/releases/${options.version}`;

/* --------------------------------------------------------- preconditions */

const failures = [];

const gate = readJson(GATE_ARTIFACT);
if (!gate) failures.push(`${GATE_ARTIFACT} is missing. Run: corepack pnpm gate:local --full`);
else {
  if (gate.headSha !== headSha) failures.push(`${GATE_ARTIFACT} was produced at ${gate.headSha?.slice(0, 12)}, not ${shortSha}`);
  if (gate.summary?.failed > 0) failures.push(`${GATE_ARTIFACT} records ${gate.summary.failed} failed step(s)`);
  if (gate.mode !== 'full') failures.push(`${GATE_ARTIFACT} mode is "${gate.mode}"; a release needs --full (tests + build)`);
}

const evidence = readJson(EVIDENCE_ARTIFACT);
if (!evidence) failures.push(`${EVIDENCE_ARTIFACT} is missing. Run: corepack pnpm evidence:live --write`);
else {
  if (evidence.headSha !== headSha) failures.push(`${EVIDENCE_ARTIFACT} was produced at ${evidence.headSha?.slice(0, 12)}, not ${shortSha}`);
}

const status = git(['status', '--porcelain']).trim();
const dirtyOutsideReleaseDir = status
  .split('\n')
  .filter(Boolean)
  .map((line) => line.slice(3).trim())
  .filter((path) => !path.startsWith(releaseDir));
if (dirtyOutsideReleaseDir.length > 0) {
  failures.push(`working tree is dirty outside ${releaseDir}: ${dirtyOutsideReleaseDir.slice(0, 5).join(', ')}`);
}

if (failures.length > 0) {
  console.error('Release build refused — verification is missing, stale, or failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error('');
  console.error('A release snapshot must carry evidence produced from its own commit.');
  process.exit(1);
}

/* --------------------------------------------------------- manifest */

const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
const files = [];
let totalBytes = 0;

for (const path of tracked.sort()) {
  const absolute = resolve(ROOT, path);
  if (!existsSync(absolute)) continue;
  const stat = statSync(absolute);
  const hash = createHash('sha256').update(readFileSync(absolute)).digest('hex');
  files.push({ path, bytes: stat.size, sha256: hash });
  totalBytes += stat.size;
}

const byTopLevel = files.reduce((acc, file) => {
  const top = file.path.includes('/') ? file.path.split('/')[0] : '(root)';
  acc[top] = (acc[top] ?? 0) + 1;
  return acc;
}, {});

const lockfileHash = createHash('sha256').update(readFileSync(resolve(ROOT, 'pnpm-lock.yaml'))).digest('hex');
const pnpmVersion = (spawnSync('corepack', ['pnpm', '--version'], { cwd: ROOT, encoding: 'utf8' }).stdout ?? '').trim();

const gapSummary = evidence.summary.byStatus;
const provenGaps = (evidence.gaps ?? []).filter((gap) => gap.status === 'PROVEN_LOCALLY').map((gap) => gap.id);
const unprovenGaps = (evidence.gaps ?? []).filter((gap) => gap.status !== 'PROVEN_LOCALLY').map((gap) => gap.id);

const release = {
  schemaVersion: 1,
  version: options.version,
  generatedAt: new Date().toISOString(),
  commit: headSha,
  shortCommit: shortSha,
  branch: git(['rev-parse', '--abbrev-ref', 'HEAD']).trim(),
  toolchain: { node: process.version, pnpm: pnpmVersion, packageManager: gate.toolchain?.pnpm },
  lockfile: { file: 'pnpm-lock.yaml', sha256: lockfileHash },
  tree: { files: files.length, bytes: totalBytes, byTopLevel },
  verification: {
    gate: {
      mode: gate.mode,
      passed: gate.summary?.passed,
      failed: gate.summary?.failed,
      total: gate.summary?.total,
      steps: (gate.steps ?? []).map((step) => ({ id: step.id, status: step.status, durationMs: step.durationMs })),
      artifact: GATE_ARTIFACT,
    },
    evidence: {
      gaps: evidence.summary?.gaps,
      proofUnits: evidence.summary?.proofUnits,
      byStatus: gapSummary,
      provenLocally: provenGaps,
      notProvenLocally: unprovenGaps,
      artifact: EVIDENCE_ARTIFACT,
    },
  },
  notVerified: evidence.notCovered ?? [],
  notes: {
    meaning:
      'This is a verified SOURCE SNAPSHOT. It is not a production release. Hosted, browser, legal and pilot evidence are absent by construction in the build environment.',
  },
};

const manifestText = files.map((file) => `${file.sha256}  ${file.path}`).join('\n');

/* --------------------------------------------------------- outputs */

if (!options.check) {
  mkdirSync(resolve(ROOT, releaseDir), { recursive: true });
  writeFileSync(resolve(ROOT, releaseDir, 'MANIFEST.json'), `${JSON.stringify(release, null, 2)}\n`);
  writeFileSync(resolve(ROOT, releaseDir, 'SHA256SUMS'), `${manifestText}\n`);
}

/* --------------------------------------------------------- release note */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatDuration(ms) {
  return ms >= 60_000 ? `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s` : `${(ms / 1000).toFixed(1)}s`;
}

const lines = [];
lines.push(`# ${options.version} — verified source snapshot`);
lines.push('');
lines.push('> **Status: NOT A PRODUCTION RELEASE.** This is a frozen, verified source snapshot of MALEK.');
lines.push('> It proves what the repository can prove about itself. It does not prove hosted behaviour,');
lines.push('> legal validity, or a real operating cycle. Read [What this snapshot does not prove](#what-this-snapshot-does-not-prove).');
lines.push('');
lines.push(`| Field | Value |`);
lines.push(`| --- | --- |`);
lines.push(`| Version | \`${options.version}\` |`);
lines.push(`| Commit | \`${headSha}\` |`);
lines.push(`| Generated | ${release.generatedAt} |`);
lines.push(`| Node / pnpm | ${process.version} / ${pnpmVersion} |`);
lines.push(`| Tracked files | ${files.length} (${formatBytes(totalBytes)}) |`);
lines.push(`| Lockfile SHA256 | \`${lockfileHash}\` |`);
lines.push('');
lines.push('## What was verified to build this snapshot');
lines.push('');
lines.push(`Local gate (\`pnpm gate:local --full\`) — **${gate.summary.passed}/${gate.summary.total} steps passed**, mode \`${gate.mode}\`:`);
lines.push('');
lines.push('| Step | Status | Duration |');
lines.push('| --- | --- | ---: |');
for (const step of gate.steps ?? []) {
  lines.push(`| \`${step.id}\` | ${step.status.toUpperCase()} | ${formatDuration(step.durationMs ?? 0)} |`);
}
lines.push('');
lines.push(`Executable evidence (\`pnpm evidence:live\`) — **${evidence.summary.gaps} gaps mapped to ${evidence.summary.proofUnits} proof units** run against a real PostgreSQL 18 engine:`);
lines.push('');
lines.push('| Status | Gaps |');
lines.push('| --- | ---: |');
for (const [state, count] of Object.entries(gapSummary)) lines.push(`| ${state} | ${count} |`);
lines.push('');
lines.push(`- **Proven locally (${provenGaps.length}):** ${provenGaps.join(', ')}`);
lines.push(`- **Not provable locally (${unprovenGaps.length}):** ${unprovenGaps.join(', ')}`);
lines.push('');
lines.push('## What this snapshot does not prove');
lines.push('');
lines.push('The environment that produced it has no Docker, no hosted Supabase project, no browser and no');
lines.push('credentials. Therefore none of the following is established by this snapshot, for any module:');
lines.push('');
for (const item of release.notVerified) lines.push(`- ${item}`);
lines.push('');
lines.push('Consequently the following gaps remain open and are **not** closed by this release:');
lines.push('');
lines.push(`- ${unprovenGaps.join(', ')}`);
lines.push('- the hosted half of the 14 locally-proven gaps (see `docs/evidence/live-evidence.md`).');
lines.push('');
lines.push('## Scope');
lines.push('');
lines.push('- **Included:** OWNER_AGENCY rental operations — properties, units, people, contracts, billing,');
lines.push('  collections, expenses, owner settlements, accounting/GL, reports, documents, settings,');
lines.push('  permissions, maintenance, utilities, AI assistant, tenant/owner portals.');
lines.push('- **Explicitly excluded:** MASTER_LEASE (GAP-012), per [ADR 0019](../decisions/0019-rc1-scope-owner-agency-only.md).');
lines.push('- **Not permitted in this snapshot:** S09 historical correction activation. It requires the');
lines.push('  accounting sign-off described in [the S08 packet](../accounting/S08_SIGN_OFF_PACKET_AR.md) (`REL-004`).');
lines.push('');
lines.push('## Integrity');
lines.push('');
lines.push(`\`SHA256SUMS\` in this directory lists the SHA-256 of every one of the ${files.length} tracked files.`);
lines.push('Verify a checkout with:');
lines.push('');
lines.push('```bash');
lines.push('sha256sum -c docs/releases/' + options.version + '/SHA256SUMS --quiet');
lines.push('```');
lines.push('');
lines.push('## Reproducing');
lines.push('');
lines.push('```bash');
lines.push('git checkout ' + headSha);
lines.push('corepack pnpm install --frozen-lockfile --ignore-scripts && corepack pnpm rebuild esbuild');
lines.push('corepack pnpm gate:local --full');
lines.push('corepack pnpm evidence:live');
lines.push(`node scripts/release/build-release.mjs --version ${options.version}`);
lines.push('```');
lines.push('');
lines.push('Expected: the gate reports every step PASS, the evidence layer reports the same gap statuses,');
lines.push('and `MANIFEST.json` reproduces the same lockfile hash and file count.');
lines.push('');

if (!options.check) writeFileSync(resolve(ROOT, releaseDir, 'RELEASE.md'), `${lines.join('\n')}`);

/* --------------------------------------------------------- archive */

let archiveNote = null;
if (options.archive && !options.check) {
  const outDir = resolve(ROOT, 'dist/release');
  mkdirSync(outDir, { recursive: true });
  const archiveName = `malek-${options.version}-${shortSha}.tar.gz`;
  const archivePath = join(outDir, archiveName);
  const prefix = `malek-${options.version}`;
  const result = spawnSync(
    'git',
    ['archive', '--format=tar.gz', `--prefix=${prefix}/`, '-o', archivePath, 'HEAD'],
    { cwd: ROOT, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    console.error(`git archive failed: ${result.stderr?.trim()}`);
    process.exit(2);
  }
  const archiveHash = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
  writeFileSync(`${archivePath}.sha256`, `${archiveHash}  ${archiveName}\n`);
  archiveNote = { name: archiveName, path: relative(ROOT, archivePath), bytes: statSync(archivePath).size, sha256: archiveHash };
}

/* --------------------------------------------------------- console */

if (options.check) {
  console.log(`${options.version} release check passed at ${shortSha}.`);
  console.log(`  files      : ${files.length} (${formatBytes(totalBytes)})`);
  console.log(`  gate       : ${gate.summary.passed}/${gate.summary.total} (${gate.mode})`);
  console.log(`  evidence   : ${evidence.summary.gaps} gaps / ${evidence.summary.proofUnits} units`);
  console.log(`  lockfile   : ${lockfileHash.slice(0, 16)}…`);
  process.exit(0);
}

console.log(`Release ${options.version} built from ${shortSha}`);
console.log(`  directory  : ${releaseDir}`);
console.log(`  files      : ${files.length} (${formatBytes(totalBytes)})`);
console.log(`  gate       : ${gate.summary.passed}/${gate.summary.total} steps (mode ${gate.mode})`);
console.log(`  evidence   : ${provenGaps.length} proven locally, ${unprovenGaps.length} not provable locally`);
console.log(`  lockfile   : ${lockfileHash}`);
if (archiveNote) {
  console.log(`  archive    : ${archiveNote.path} (${formatBytes(archiveNote.bytes)})`);
  console.log(`  archive sha: ${archiveNote.sha256}`);
}
console.log('');
console.log('Reminder: this is a verified SOURCE snapshot, not a production release.');
