import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const evidencePath = 'evidence/wp07/financial-reconciliation-evidence.json';

// Run the authoritative reconciliation generator first. That script records
// the git SHA of the code that generated the evidence. A committed evidence
// file cannot also contain the SHA of the commit that contains itself, so the
// closeout wrapper normalizes the provenance field to its truthful semantics.
execFileSync(process.execPath, ['scripts/wp07/run-reconciliation-pglite.mjs'], {
  stdio: 'inherit',
});

const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));

if (typeof evidence.rc_sha === 'string' && evidence.rc_sha.length > 0) {
  evidence.generation_source_sha = evidence.rc_sha;
  delete evidence.rc_sha;
}

evidence.candidate_binding =
  'The authoritative RC SHA is the Git commit that contains this evidence file; it is intentionally not self-referential.';
evidence.generator_script = 'scripts/wp07/run-reconciliation-pglite-closeout.mjs';
evidence.source_generator_script = 'scripts/wp07/run-reconciliation-pglite.mjs';

writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log('Normalized WP-07 reconciliation provenance without self-referential SHA claims.');
