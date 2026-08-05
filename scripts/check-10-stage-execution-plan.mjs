import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const paths = {
  decision: join(repoRoot, 'governance', 'final-decision-register.json'),
  decisionChecksum: join(repoRoot, 'governance', 'final-decision-register.sha256'),
  plan: join(repoRoot, 'governance', '10-stage-master-plan.json'),
  planChecksum: join(repoRoot, 'governance', '10-stage-master-plan.sha256'),
  agent: join(repoRoot, 'docs', 'execution', '10_STAGE_AGENT_CHECKLIST_AR.md'),
  reviewer: join(repoRoot, 'docs', 'execution', '10_STAGE_REVIEW_LEDGER_AR.md'),
};

const failures = [];
const fail = (message) => failures.push(message);

function verifyChecksum(filePath, checksumPath, expectedRelativePath) {
  const bytes = readFileSync(filePath);
  const actual = createHash('sha256').update(bytes).digest('hex');
  const line = readFileSync(checksumPath, 'utf8').trim();
  const match = line.match(/^([a-f0-9]{64})\s+(.+)$/);
  if (!match) {
    fail(`${checksumPath} must contain one SHA-256 line`);
    return actual;
  }
  if (match[2] !== expectedRelativePath) {
    fail(`${checksumPath} targets ${match[2]} instead of ${expectedRelativePath}`);
  }
  if (match[1] !== actual) {
    fail(`${expectedRelativePath} checksum mismatch: expected ${match[1]}, actual ${actual}`);
  }
  return actual;
}

function extractTaskIds(markdown) {
  return [...markdown.matchAll(/\*\*(S\d{2}-T\d{2})\*\*/g)].map((match) => match[1]);
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

const decisionSha = verifyChecksum(
  paths.decision,
  paths.decisionChecksum,
  'governance/final-decision-register.json',
);
const planSha = verifyChecksum(
  paths.plan,
  paths.planChecksum,
  'governance/10-stage-master-plan.json',
);

const decision = JSON.parse(readFileSync(paths.decision, 'utf8'));
const plan = JSON.parse(readFileSync(paths.plan, 'utf8'));
const agentMarkdown = readFileSync(paths.agent, 'utf8');
const reviewerMarkdown = readFileSync(paths.reviewer, 'utf8');

if (decision.status !== 'LOCKED_FINAL') fail('decision register status must be LOCKED_FINAL');
if (decision.blocked_decisions !== 0) fail('blocked_decisions must be zero');
if (decision.provisional_decisions !== 0) fail('provisional_decisions must be zero');
if (!Array.isArray(decision.decisions) || decision.decisions.length < 18) {
  fail('decision register must contain at least D01-D18');
}
const decisionIds = decision.decisions.map((item) => item.id);
for (let index = 1; index <= 18; index += 1) {
  const expected = `D${String(index).padStart(2, '0')}`;
  if (!decisionIds.includes(expected)) fail(`missing decision ${expected}`);
}

if (plan.status !== 'LOCKED_PLAN') fail('master plan status must be LOCKED_PLAN');
if (plan.rules?.stage_count !== 10) fail('stage_count must equal 10');
if (plan.rules?.one_stage_per_pr !== true) fail('one_stage_per_pr must be true');
if (plan.rules?.branch_from_latest_main !== true) fail('branch_from_latest_main must be true');
if (plan.rules?.agent_may_edit_reviewer_ledger !== false) {
  fail('agent_may_edit_reviewer_ledger must be false');
}
if (plan.rules?.stage_complete_requires_agent_and_reviewer !== true) {
  fail('stage_complete_requires_agent_and_reviewer must be true');
}
if (plan.rules?.evidence_required_for_every_task !== true) {
  fail('evidence_required_for_every_task must be true');
}
if (plan.rules?.no_cherry_pick_from_superseded_business_branch !== true) {
  fail('no_cherry_pick_from_superseded_business_branch must be true');
}
if (!Array.isArray(plan.stages) || plan.stages.length !== 10) {
  fail('master plan must contain exactly 10 stages');
}

const expectedStageIds = Array.from({ length: 10 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`);
const actualStageIds = plan.stages.map((stage) => stage.id);
if (JSON.stringify(actualStageIds) !== JSON.stringify(expectedStageIds)) {
  fail(`stage IDs/order must be ${expectedStageIds.join(', ')}`);
}

const planTaskIds = plan.stages.flatMap((stage) => stage.task_ids ?? []);
if (planTaskIds.length !== 98) fail(`master plan must contain exactly 98 task IDs, found ${planTaskIds.length}`);
const planDupes = duplicates(planTaskIds);
if (planDupes.length) fail(`duplicate plan task IDs: ${planDupes.join(', ')}`);

const agentTaskIds = extractTaskIds(agentMarkdown);
const reviewerTaskIds = extractTaskIds(reviewerMarkdown);
for (const [label, ids] of [['agent checklist', agentTaskIds], ['review ledger', reviewerTaskIds]]) {
  const dupes = duplicates(ids);
  if (dupes.length) fail(`${label} contains duplicate task IDs: ${dupes.join(', ')}`);
  const missing = planTaskIds.filter((id) => !ids.includes(id));
  const extra = ids.filter((id) => !planTaskIds.includes(id));
  if (missing.length) fail(`${label} missing IDs: ${missing.join(', ')}`);
  if (extra.length) fail(`${label} has unknown IDs: ${extra.join(', ')}`);
}

if (!agentMarkdown.includes('READY_FOR_INDEPENDENT_REVIEW')) {
  fail('agent checklist must require READY_FOR_INDEPENDENT_REVIEW handoff');
}
if (!agentMarkdown.includes('business/domain-contract-foundation')) {
  fail('agent checklist must explicitly forbid reuse of superseded business branch');
}
if (!reviewerMarkdown.includes('الوكيل ممنوع من تعديل هذا الملف')) {
  fail('review ledger must explicitly prohibit agent edits');
}
if (plan.decision_register_sha256 !== decisionSha) {
  fail(`master plan decision_register_sha256 must equal ${decisionSha}`);
}

if (failures.length) {
  for (const message of failures) console.error(`EXECUTION_PLAN_GUARD_FAILED: ${message}`);
  process.exit(1);
}

console.log(`Final decision register verified: ${decisionSha}`);
console.log(`10-stage plan verified: ${planSha}`);
console.log(`Stages: ${plan.stages.length}; Tasks: ${planTaskIds.length}; Decisions: ${decision.decisions.length}`);
