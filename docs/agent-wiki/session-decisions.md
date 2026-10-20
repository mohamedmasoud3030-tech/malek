# Session decisions

> **Recorded:** 2026-10-19 · **Repository state:** `malek@f2b6de55593e611f8e7713fb21e14cad14fbf67a`
> **Authority:** agent memory only — see [index](index.md).

Dated decisions taken in this session, newest first. A decision here is not a product/accounting rule
and grants no stage credit.

## 2026-10-19

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

Verified at `f2b6de5` on 2026-10-19: **13/13 PASS in 115 s** (default mode). The first execution
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
