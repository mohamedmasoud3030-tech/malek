# Known traps

> **Recorded:** 2026-10-19 · **Repository state:** `malek@f2b6de55593e611f8e7713fb21e14cad14fbf67a`
> **Authority:** agent memory only — see [index](index.md).

Each trap below has already cost real time in a real session. Read this before diagnosing.

## 1. The canonical documents are pinned to five different commits — none of them HEAD

At `f2b6de5`, the documents declare these baselines:

| Document | Declared baseline |
| --- | --- |
| [Canonical Pack index](../source-of-truth/00_INDEX.md) | `main@9e5c32e8` |
| [Document 7](../source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md) | `main@da9a98a3`, audit cut-off **2026-08-15** |
| [Document 8](../source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md) | `main@da9a98a3` |
| [10_STAGE_STATUS_AR.md](../execution/10_STAGE_STATUS_AR.md) | `main@8ada4e7e` |
| [governance/10-stage-master-plan.json](../../governance/10-stage-master-plan.json) | `created_from_main_sha: 0b4756df` |

Consequences:

- A row marked `ENGINEERING COMPLETE` in Document 7 describes `da9a98a3`, not `f2b6de5`. Re-check the
  code before repeating it.
- Never copy a baseline SHA into a new report as if it were current. Cite the SHA you actually
  inspected.
- Updating those headings is *not* an ordinary docs edit — the Pack is canonical and changing its
  baseline claim changes an authority statement. Record the drift here instead, and ask.

## 2. `pnpm lint` is not a linter

At `f2b6de5`, [malek-app/package.json](../../malek-app/package.json) defines:

```json
"lint": "tsc -p tsconfig.json --noEmit"
```

which is byte-for-byte the `typecheck` script. There is no ESLint dependency, no config file, and no
lint plugin anywhere in the repository. The CI job is nevertheless named
**`CI / Typecheck, Lint & Build`** and its step is labelled lint.

So: `lint` adds zero signal over `typecheck`, and no style/correctness rule
(e.g. floating promises, exhaustive hook deps, unused vars) is enforced. SonarCloud is the only
static-analysis product in the pipeline. This is an open decision — see
[open-questions.md](open-questions.md).

## 3. Several guards are **diff-scoped** and are no-ops on an unchanged branch

`check:migration-hygiene` and `check:gl-write-boundary` compare the working tree to `origin/main`
(override with `--base <ref>`). On a branch with no relevant changes they print green while checking
nothing. Observed at `f2b6de5`:

```text
S03 GL Write Boundary Guard: OK (base ref: origin/main; production files checked: 0)
```

Green here means "this branch added no violation", never "the tree is clean". Using a stale local
`origin/main` also silently changes the answer — run `git fetch origin main` first.

## 4. `db0:gate` prints "7/7" while two sub-gates are skipped

`idempotency` and `role-model` are skipped on the single canonical-dump bootstrap. The total still
reads 7/7. See [gate-inventory.md](gate-inventory.md#db0gate-sub-gate-detail--the-77-trap).

## 5. `$?` after a pipe reports the wrong process

```bash
corepack pnpm db0:gate 2>&1 | tail -40; echo "exit=$?"   # reports tail's status, not the gate's
```

Use `${PIPESTATUS[0]}` (bash) or `set -o pipefail`. This produced a false "exit=0" in this very
session before it was caught.

## 6. Piping a long process into `tail` hides all progress

`pnpm --filter ./malek-app test | tail -60` produces **no output for ~9 minutes** and looks hung.
Redirect to a file (`> /tmp/test.log 2>&1`) and tail the file, or run it as a background process.

## 7. Node version drift: local 22 vs CI 24

Every workflow pins `node-version: 24`. This sandbox has `v22.22.3`. `engines` only pins pnpm.
A local green run is evidence for the sandbox, not for CI.

## 8. `.env.*` ignores silently swallow new templates

`.gitignore` contains `.env`, `.env.*`, `!.env.example`, and later `.env.qa.*`. Consequence, verified
with `git check-ignore --no-index`:

| Path | Ignored by |
| --- | --- |
| `.env.qa.local` | `.env.qa.*` |
| `.env.new.example` | `.env.*` — **a new template is silently ignored** |
| `.env.example` | not ignored (`!.env.example`) |

`.env.qa.example` and `.env.production-demo.example` are only in git because they were tracked before
the rule mattered. If you add a new template and `git status` stays clean, this is why.

> **Superseded on 2026-10-19:** `.gitignore` now also carries `!.env.*.example` and
> `!.env.qa.example`. Verified after the change: `.env.new.example`, `.env.qa.example` and
> `.env.production-demo.example` are trackable, while `.env.qa.local` and `.env.local` remain ignored.
> The original observation stands as history; new templates matching `*.example` are no longer lost.

## 9. Other environment facts that look like bugs

- `supabase/config.toml` is gitignored, so a local `supabase start` has no committed configuration.
- `.gitignore` contains a bare `x` line, which ignores any file or directory named `x`.
- The `preinstall` hook hard-fails unless the package manager is pnpm — deliberate, but it makes
  `npm`/`yarn` reproduce errors that say nothing about the code.
- `db0:gate`'s `regressions` sub-gate is the slow one (~41 s of the 59 s). Do not "optimise" it away.

## 10. Governance traps (these are violations, not just mistakes)

- Never edit the Reviewer ledger or mark reviewer checkboxes; never grant stage credit.
- Never convert `NOT_STARTED` into "no code exists" — S04/S06/S08 have real repository implementations.
- Never convert "migration + tests exist" into `COMPLETE`.
- Do not begin historical correction/backfill before an approved S08 analysis; `S09` is gated at the
  database level too.
