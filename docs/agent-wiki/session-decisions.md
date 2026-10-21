# Session decisions

> **Recorded:** 2026-10-21 · **Repository state:** `malek@dd4e4b11ff5` (after the `v1.0.0-rc.1` snapshot merged)
> **Authority:** agent memory only — see [index](index.md).

Dated decisions taken in this session, newest first. A decision here is not a product/accounting rule
and grants no stage credit.

## 2026-10-21 (late)

### The stale-session fix was rebuilt, not merged as-is

PR #1832 was opened 2026-09-21 against `rentrix-app/`; the tree has since been renamed to `malek-app/`,
so the branch shares no merge base with `main` and could not be reviewed as a diff. Its intent was
kept, its two defects were fixed, and the result is
[ADR 0021](../decisions/0021-restored-session-verification.md): verify the restored token with
`auth.getUser()` before the shell opens, refresh once on a refusal, and distinguish a server refusal
from an unreachable server so a flaky network cannot force a sign-out.

The PR's CSP `wasm-unsafe-eval` relaxation was dropped: PGlite is a root **devDependency used by
tests only**, so no WebAssembly reaches the bundle. Widening the production policy for an unused
capability would have been a real weakening, not a fix.

### PR #1836 (root docs move) was closed, not merged

It renamed `CLAUDE.md`, `AGENT_HANDOVER.md` and `DATABASE_RULES.md` into `docs/` without touching any
reference (36 exist). `AGENTS.md` line 9 instructs every agent to read `DATABASE_RULES.md` from the
root, and `CLAUDE.md` must sit at the root for agent tooling to discover it. A cosmetic move that
breaks tool discovery is a regression, so the intent — a tidy root — is served by the measurement in
[the hygiene audit](../operations/REPOSITORY_HYGIENE_2026-10-21.md) instead.

## 2026-10-21 (evening)

### Shipped the executable evidence layer

`pnpm evidence:live` maps 18 open gaps to 17 proof units, executes them against a real PostgreSQL 18
engine (PGlite replayed from `supabase/migrations`), and writes a SHA-stamped report to
`docs/evidence/live-evidence.md`. Result at `d647030`: **14 PROVEN_LOCALLY, 4 NO_LOCAL_PROOF**.

Rejected alternative: writing new SQL scenarios from scratch. The repository already carries the
executable proofs; the missing piece was the gap-keyed artifact, not more SQL.

### Added a SQL-signature documentation guard

While writing the S08 sign-off packet I documented three function signatures from memory. All three
were wrong (`s08_create_frozen_review` takes `p_payload jsonb`, not company/period arguments;
`s08_approve_frozen_review` takes `p_review_id, p_notes`, not a decision/reason triple). The guard
`pnpm check:sql-signatures` now replays the schema and compares every signature declared between
`<!-- sql-signatures -->` markers. Negative-tested by corrupting one row: it failed with the exact
schema mismatch, then passed after restore.

### S08 sign-off packet and hosted runbook

- `docs/accounting/S08_SIGN_OFF_PACKET_AR.md` — makes GAP-015/016 signable in one 60–90 minute review.
  It does not grant the signature; it only removes every other reason for delay.
- `docs/operations/HOSTED_EVIDENCE_RUNBOOK_AR.md` — the ordered commands that turn GAP-021 and the
  hosted half of the other 12 into one session of work.

## 2026-10-21 (later)

### Delivery advisory produced with `doc-coauthoring`

The owner asked for an expert consulting document covering the path from the current state to
delivery, and for a GitHub skill to produce it with. Chosen: `doc-coauthoring` from
`anthropics/skills`, adopted as method only — see [delivery-advisory.md](delivery-advisory.md).
SDD frameworks and `superpowers/writing-plans` were rejected because both prescribe their own plan
store, which would become a parallel planning authority.

Outcome: [`docs/advisory/2026-10-21-delivery-consultation-ar.md`](../advisory/2026-10-21-delivery-consultation-ar.md).
It is advisory; it closes no gap and grants no credit.

### Date correction

The first wiki pages were dated `2026-10-19`, taken from container file timestamps. The actual session
date is **2026-10-21**; every page was corrected. The earlier commit messages still say 2026-10-19 —
history is not rewritten. Recorded here so the discrepancy is not read as a conflicting claim.

## 2026-10-21

### The wiki's format rules are enforced by `pnpm check:wiki`

A guard (`scripts/check-agent-wiki.mjs`) fails when a page is orphaned, does not link back to
`index.md`, is missing an H1, or lacks a `> **Recorded:** YYYY-MM-DD ...` line citing a commit.
Negative-tested by creating an orphan page and by adding a link to a nonexistent page; both failed
with specific messages. It is wired into `pnpm gate:local` (14 steps).

CI wiring is **not** done: adding a step to `ci.yml` changes the pipeline that every PR depends on,
and `check-workflow-honesty` governs workflow declarations. Proposed below instead.

### Proposed recurring schedules (not enabled — this harness has no scheduler)

| Cadence | Job | Why |
| --- | --- | --- |
| Per PR | `pnpm check:wiki` + `pnpm gate:local --quick` | keeps the wiki navigable and catches obvious guard regressions in under a minute |
| Daily | `pnpm gate:local --full` on `main`, evidence archived | detects drift between the gate inventory's numbers and reality |
| Weekly | wiki lint: contradictions, orphan pages, superseded claims, stale `Recorded:` lines | the wiki's own "Lint" operation; cannot be automated past form checks |
| Monthly | re-verify documented SHAs and timings; refresh the gate inventory | measured numbers decay with every merge |

None of these can be created from here. They should be added as GitHub Actions scheduled workflows by
the owner, or run manually until then.

### The wiki lives at `docs/agent-wiki/`

Chosen by the owner. In-repo, version-controlled, cited by commit. It is explicitly subordinate to the
[Canonical Pack](../source-of-truth/00_INDEX.md) and must never define a business, accounting,
permission, security or IA rule. Rationale: it travels with the repository and survives session
compaction, unlike chat context.

### The session goal is environment hardening, not feature delivery

Chosen by the owner. Work this session should make the *next* task cheaper: verified bootstrap,
capability matrix, gate inventory, traps, and evidence pointers.

### No ESLint was added

Observed: `lint` is `tsc --noEmit`, identical to `typecheck`; there is no linter in the repository.
**Not fixed unilaterally**, because:

- adding a dependency stack is a policy decision while
  [CI_COST_POLICY.md](../decisions/CI_COST_POLICY.md) is explicitly trying to *reduce* per-PR work;
- SonarCloud already analyses `malek-app/src`, `supabase/functions` and `scripts`;
- a repo-wide adoption on 559 test files and 1,367 app files would either flood or require a
  hand-built ratchet.

Recorded as [open question 2](open-questions.md) with the trade-offs. Until decided, agents must not
claim "lint passes" implies anything beyond typechecking.

### Canonical documents were not edited, despite stale baselines

Documents 7, 8 and the status ledger all cite different commits (see
[known-traps.md](known-traps.md)). Rewriting their baseline headings changes an authority statement.
The drift is recorded instead, and listed as an open question.

### `pnpm gate:local` was added

A single entry point that runs the safe, credential-free subset, prints a summary table and writes
machine-readable evidence to `.gate/last-run.json` (gitignored). It exists so agents stop hand-typing
eight commands, and so their claims can point at an artifact instead of prose. It duplicates no
governance logic: it invokes the existing scripts unchanged.

Verified at `f2b6de5` on 2026-10-21: **13/13 PASS in 115 s** (default mode). The first execution
failed four steps because `--filter ./malek-app` was passed as a single argv element; the runner now
rejects any argv element containing whitespace at startup so that mistake cannot recur silently.

### No subagent tool exists in this harness

The session brief asks for all work to run in subagents. This harness has no subagent/Task primitive.
The discipline is emulated with isolated background processes, file-based handoff (wiki pages, commits,
evidence JSON), and by keeping the main context limited to pointers. **Recorded so no future agent
believes subagent transcripts exist.**

### No live/runtime verification was claimed

No Docker, no hosted Supabase credentials, no browsers. Every hosted or browser claim in this wiki is
marked unproven by construction.
