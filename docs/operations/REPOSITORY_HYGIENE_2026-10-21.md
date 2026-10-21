# Repository hygiene audit — 2026-10-21

> **Status:** `OPERATIONAL` audit record. Date-stamped; re-run the commands to re-measure.
> **Snapshot:** `v1.0.0-rc.1`; the exact commit and per-file checksums are recorded in the manifest
> listed under [`docs/releases/`](../releases/README.md).
> **Scope:** structure, cleanliness, documentation authority and outstanding branch hygiene of the
> whole repository. It changes nothing; it records what a reviewer needs before trusting the snapshot.

## 1. What each top-level location owns

| Location | Files | Owns | Must not become |
| --- | ---: | --- | --- |
| `malek-app/` | 1,367 | The single active application workspace: shell, features, services, tests, E2E, per-app scripts. | A second app, or a parallel workspace. |
| `docs/` | 143+ | Canonical Pack, decisions, execution ledgers, operations runbooks, evidence, advisory, agent wiki. | A place where a *new* source of truth is invented. |
| `supabase/` | 128 | Executable schema (one consolidated baseline + follow-up migrations), RLS templates, Edge Functions, seed. | A place to edit applied history in place. |
| `scripts/` | 80+ | Repository-wide gates: DB0, guardian, security, QA, evidence, release tooling. | A place for one-off agent scaffolding. |
| `.github/` | 16 | 14 workflows, CODEOWNERS, issue templates. | A workflow that reports a skipped job as a pass. |
| `.claude/` | 16 | Agent discovery adapters, rules, commands. | A second rule system that contradicts `AGENTS.md`. |
| `governance/` | 7 | Locked decisions + stage plan, all checksum-pinned. | An agent-editable status file. |
| `skills/` | 7 | Agent-agnostic task procedures (`database`, `review`, `architecture-decision`). | A vendor dump of third-party skills. |
| `patches/` | 1 | Reviewed PDFKit patch. | An unreviewed dependency override. |

**Root files (20).** All are load-bearing: `AGENTS.md`, `CLAUDE.md`, `README.md`, `DATABASE_RULES.md`,
`CHANGELOG.md`, four package/workspace manifests, three TypeScript configs, two deployment configs
(`vercel.json`, `.replit`), `.npmrc`, `.gitignore`, `sonar-project.properties`, and two env templates.

One root file is a **candidate for relocation, not deletion**: `DOCUMENT_DESIGN_PROPOSALS.html`
(34 KB, a design exploration). Relocating it is the subject of open PR #1836, which moves root
documents into `docs/` with zero deletions. Doing it here as well would create a conflicting change,
so this audit records it and defers.

## 2. Documentation authority map (prevents "which doc is true?")

| Layer | Location | Rule |
| --- | --- | --- |
| Canonical product truth | `docs/source-of-truth/00_INDEX.md` + Documents 01–08 | Outranks everything except locked governance decisions. |
| Locked decisions | `governance/final-decision-register.json`, `docs/decisions/0011…0018` | Immutable; superseded by new ADRs, never edited. |
| Governed stage credit | `governance/10-stage-master-plan.json` + ledgers | Only these grant S01–S10 credit. |
| Operations | `docs/operations/*RUNBOOK*`, `BACKUP_RESTORE`, `MONITORING` | How to operate; not authority on product rules. |
| Evidence | `docs/evidence/`, `docs/execution/evidence/` | Generated, SHA-stamped. Never hand-edited. |
| Advisory & agent memory | `docs/advisory/`, `docs/agent-wiki/` | Explicitly subordinate; cannot define a rule. |
| Historical | `docs/execution/HANDOFF_*`, `docs/inventory/`, superseded reports | History only. Never quoted as current. |

## 3. Cleanliness evidence (measured, not asserted)

| Check | Command | Result |
| --- | --- | --- |
| Secrets in tracked files | pattern scan for JWT-shaped keys, `sk-…`, service-role assignments | **none** outside test fixtures and the existing secret-scan report |
| Committed generated output | `git status --porcelain --ignored` | only `node_modules/` and `.gate/` — both ignored |
| Documentation links | `pnpm check:docs` | 128 files, **0 broken links** |
| Agent wiki integrity | `pnpm check:wiki` | 10 pages, all linked, all dated |
| `TODO`/`FIXME` in app source | `git grep` over `malek-app/src` | **0** |
| Env template ignore hole | `git check-ignore --no-index` | fixed: `*.example` templates are trackable; `.env.local` and `.env.qa.local` stay ignored |
| Release archives | `.gitignore` | `dist/release/` ignored |
| Dead migration filenames in docs | `pnpm audit:gaps` | 6 citations are historical pointers after the baseline consolidation; explained in Document 7 |

## 4. Branch hygiene (report only — nothing deleted)

Measured 2026-10-21. `main` is the only canonical branch.

| Branch | Status | Recommendation |
| --- | --- | --- |
| `main` | canonical | keep |
| `arena/305f966e-malek` | this session's branch, merge target for the release tooling | keep until merged |
| `arena/b65137a0-malek` | fully merged (PR #1837), 0 commits ahead | safe to delete after the release tag |
| `arena/01a0c612-malek` | stale since 2026-10-07, diverged history | archive or delete with owner approval |
| `arena/35340dd0-malek` | stale since 2026-10-09 (the inventory handover branch) | archive or delete with owner approval |
| `chore/root-docs-cleanup` | open as PR #1836 since 2026-10-18 | decide: merge after re-basing, or close |
| `fix/auth-bootstrap-401-…` | open as PR #1832 since 2026-09-21, CI failing | decide: fix and merge, or close with a note |
| `pr1834-fix` | stale since 2026-10-07 | archive or delete with owner approval |

**Why nothing was deleted here:** deleting a remote branch destroys work that may not exist elsewhere,
and these branches carry commits that `main` does not (`git rev-list --count` shows large divergence).
That is an owner decision, not a cleanup convenience.

## 5. Two open PRs and what they mean for the snapshot

| PR | Age | Effect on this snapshot |
| --- | --- | --- |
| #1836 — move root documents into `docs/` | 3 days | Cosmetic ordering. The snapshot is valid without it. |
| #1832 — recover stale browser sessions | 30 days | An **auth reliability fix**, not in `main`. It is not a blocker for a source snapshot, but it is a real production concern: if it is still needed, it should be fixed and merged rather than left open for another month. |

## 6. Recommendations (not executed)

1. Resolve #1832 within one week — either rebase and fix CI, or close with a written rationale.
2. Decide #1836, then delete the three stale `arena/*` branches.
3. Add `pnpm check:wiki` and `pnpm check:sensitive-writes` as CI steps (they are in `gate:local` but not
   in `ci.yml`); this needs a workflow change and a review of `check-workflow-honesty`.
4. Replace the root `DOCUMENT_DESIGN_PROPOSALS.html` with a Markdown page under `docs/ui-ux/` once #1836 lands.
5. Keep `db0:gate`'s two skipped sub-gates visible: a green "7/7" that hides two skips is the single most
   repeated misreading in this repository (see `docs/agent-wiki/gate-inventory.md`).
