# PHASE 6 — SECURITY: Sonar workflow verification + full-history secret scan

Date: 2026-09-13 (Asia/Muscat)
Repo: `mohamedmasoud3030-tech/malek` (**public**), branch `main` @ `13e4f5947a1348adcf72755feda04c696cc1f46a`

> Redaction policy: no secret value is reproduced in this report, in any commit, or in
> tool output. Findings are identified by commit SHA, path and SHA-256 fingerprint only.

---

## 1. Workflow verification — the owner's fix is correct; no change was made to `sonar.yml`

Target: `.github/workflows/sonar.yml` @ `492db36eb2b29bd49c9b7bdf8c8c25e51cffc5f3` ("Update sonar.yml", 2026-09-12).

| Required property | Result | Evidence |
| --- | --- | --- |
| PR body text cannot provide the active Sonar credential | **PASS** | no `PR_BODY` env, no `pull_request.body` / `issue.body` / `comment.body` / `head_commit.message` reference anywhere in the file; `SONAR_CREDENTIAL_MARKER` parser deleted |
| Credentials come from GitHub Secrets | **PASS** | line 33 `SECRET_TOKEN: ${{ secrets.SONAR_TOKEN }}`; line 49 `TOKEN="${SECRET_TOKEN}"` is the fallback source |
| No credential-injection path remains | **PASS (with 2 residual risks, §3–4)** | resolution order is `workflow_dispatch` input (line 34, gated to write-permitted actors) → secret; `permissions: contents: read` (lines 19–20); every token is `::add-mask::`-ed (line 56) before use |

History of the removed defect:

- `5d71a475` (2026-09-11) *introduced* `PR_BODY` → `grep 'SONAR_CREDENTIAL_MARKER v1: …'` resolution on `pull_request` events.
- `492db36e` (2026-09-12) *removed* it and added the explanatory comment. This is the owner's fix. It is complete and correct as to `main`.

**Functional proof** (not just grep): `scripts/security/verify-sonar-token-source.sh` extracts the *shipped* `Resolve SONAR_TOKEN` step and replays it.

```
main, full mode :  13 passed, 0 failed   exit 0
main, static    :   6 passed, 0 failed   exit 0   (this is what CI runs)
vulnerable §tip :   3 passed, 3 failed   exit 1   (negative control — harness detects the flaw)
mask/secret removed: 11 passed, 2 failed  exit 1   (second negative control)
```

Attack replays executed: PR body carrying a valid-format marker **plus** a set secret → secret wins, canary absent from `GITHUB_ENV`; PR body as the *only* source with an empty secret → `exit 1` (fails closed); marker-shaped text → never parsed.

---

## 2. CRITICAL FINDING — a SonarCloud **user** credential is still live and readable in `main` history

Not a file: it is in a **commit message**, which both scanners and all file-based greps missed.

- Location: commit `4e3dd1fc66055821095882d4651c4ade5ba08a90` ("TEST-DELETE permissions probe (#1818)", author `arena-ai-coding-agent[bot]`, 2026-09-12 00:42:58 UTC), trailer `SONAR_CREDENTIAL_MARKER v1: <40-hex>`.
- Reachability: `git merge-base --is-ancestor 4e3dd1fc origin/main` → **true**; it is the tip of `origin/fix/sonar-pr-body-credential`; also in `arena/01a0911c-malek`, `arena/01a09383-malek`, `audit/rls-write-grants-review`. Repo is public ⇒ `https://github.com/<repo>/commit/4e3dd1fc` shows it to anyone; it is also returned verbatim by `GET /repos/.../commits/4e3dd1fc`.
- Fingerprint (safe to share): `sha256 ced0915ba527639dfb2d55d749a99bd8666a86c84ac3fac44208e0610a169838`, length 40, lowercase hex, prefix `52a41…`.
- It is **not** the git object id of anything in the repo (checked: `git cat-file -t` fails).

**Live-state evidence (this is the headline):** `GET https://sonarcloud.io/api/authentication/validate` with that credential returns `HTTP 200 {"valid":true}` — **the credential was never revoked**. `GET /api/user_tokens/search` also returns `HTTP 200`, i.e. it is a **user-scope** token, not a project analysis token, and it enumerates the owning account (`mohamedmasoud3030-tech-…@github`) and **five** token names, including ones for other projects (`Analyze "property-pal"`, `Analyze "Lena-spa"`, `Analyze "rentrixxx"` ×2, `Arena`). `api/organizations/search` authenticated (HTTP 400 = bad request, not 401) but org admin was not established.

Blast radius: anyone reading public history can run scans as that account, push fabricated "clean" analyses, and — because it is a user token — enumerate the account's other projects/tokens. This is strictly worse than the workflow bug that was already fixed.

The PR body that once carried this marker **has** been scrubbed: PR #1818 (1112 chars) and #1819 (empty body) contain no marker; GitHub search `repo:… SONAR_CREDENTIAL_MARKER is:pull-request` → 0. So the transient GitHub-side carrier is closed; only the commit object remains.

### Rotation status (answers "has it been done?")
- A *new* credential is in use and healthy: `SONAR_TOKEN` secret resolved successfully for `pull_request` run **#34** (`56515ba3`, 2026-09-12T20:56Z) and post-fix `push` run **#35** (`13e4f594`, 22:04Z) — both `success`, steps "Resolve SONAR_TOKEN"/"Diagnose"/"SonarCloud scan" all `success`. The old secret was documented expired (HTTP 401), so a working secret means it was replaced in the Secrets UI.
- **But rotation is only half done: revocation of the exposed credential never happened.** Replacing the secret without revoking the leaked token leaves the published value valid forever.

### Required actions (owner-only; no agent can do these)
1. SonarCloud → *My Account → Security*: **revoke every listed token** (all five, not just the leaked one), then generate a **new Project Analysis Token** for `mohamedmasoud3030-tech_rentrixxx` and paste it into `Settings → Secrets and variables → Actions → SONAR_TOKEN`. Project analysis tokens cannot read user data, which caps future blast radius.
2. Revoke the **GitHub fine-grained PAT** that was pasted in plaintext into the Phase 6 chat (the `github_pat_…` token — value intentionally not reproduced here). It can read this repo's private workflow-run metadata, so treat it as burned regardless of scope. Consider org-level fine-grained token policies and short expiry.
3. Verify in the SonarCloud UI that no unexpected token names appear before revoking (to see if anything new was created by a third party).

---

## 3. HIGH — stale branch still ships the vulnerable workflow (`origin/fix/sonar-pr-body-credential`)

The branch is fully merged (`origin/main..origin/fix/sonar-pr-body-credential` is empty; its tip is an ancestor of `main`), **but its tip still contains `PR_BODY` + the marker parser** (`git show origin/fix/sonar-pr-body-credential:.github/workflows/sonar.yml`, lines 35/48/49).

Why it matters: on a `pull_request` event, GitHub runs the workflow **from the PR head ref**. Because the fix landed on `main` via direct commit instead of through this branch, any new PR opened from `fix/sonar-pr-body-credential` would resurrect the PR-body credential path with no PR review. `arena/01a0911c-malek` carries the same content (`pr-body_lines=3`).

Action: delete both stale branches, or fast-forward each to `main`. (Not possible with the supplied token: `GET …/git/refs/heads/fix/…` → 200 read-only; secret/branch write scopes → 403.)

---

## 4. MEDIUM — advisory only, deliberately **not** applied (per instruction not to touch `sonar.yml`)

`echo "SONAR_TOKEN_EFFECTIVE=${TOKEN}" >> "$GITHUB_ENV"` (line 57) is fed by the free-text `token_override` dispatch input (line 10-13, `required: false`). A newline in that input injects arbitrary `GITHUB_ENV` lines. Trigger requires write access, so severity is moderate, but the input is unconstrained. Suggested change (owner call):

```yaml
if [ -n "${OVERRIDE_TOKEN}" ]; then
  case "${OVERRIDE_TOKEN}" in
    *[!A-Za-z0-9]*|"") echo "::error::token_override must be alphanumeric only"; exit 1;;
  esac
  TOKEN="${OVERRIDE_TOKEN}"; SOURCE="dispatch-override"
fi
```

Also note lines 59–77: the diagnose step writes the first 300 chars of authenticated SonarCloud API responses into `::notice` annotations. If an upstream API ever echoes request details, a secret could reach annotations (masked in *logs*, still visible to token holders elsewhere). Consider printing status codes only.

---

## 5. Full-history secret scan — engines, coverage, and triage

| Engine | Scope | Result |
| --- | --- | --- |
| `gitleaks v8.21.2` (`detect --redact`, default rules) | `--all` refs, **3,806 commits** (verified against `git rev-list --all \| wc -l` = 3806; the 4,778 figure includes non-commit objects), 21.5 s | **110 findings** reported → 103 in deleted files, 7 live in `main`, **all 110 false positives** (§below) |
| `gitleaks detect --no-git --redact` | current worktree | **0 findings** |
| `trufflehog v3.88.5` `git file://… --only-verified` | full history (50,204 chunks / 68.7 MB) | **0 verified, 0 unverified** |
| `trufflehog` unverified pass | full history | 6 results (2× SonarCloud, 2× Postgres, 1× URI, 1× GitHub), **0 verified**, no file/commit metadata |
| targeted greps `git grep` / pickaxe `git log --all -S` | all refs | no `sqp_*`, no `github_pat_*`, no `eyJ…` JWTs, no private-key blocks in any tracked file |
| commit-metadata sweep `git rev-list --objects --all --pretty=fuller` | all refs | **1 hit = the finding in §2** (no file-based scanner covers commit messages) |

**gitleaks triage (all 110 = false positives, verified by shape, not by assumption):**
- 92× `generic-api-key` inside `attached_assets/Pasted-*.txt` (6 files) — pasted browser console/CSP violation reports whose query strings (`?sentry_key=…&…`) trip the rule. `attached_assets/` no longer exists in `main` (`git ls-tree origin/main | grep -c attached_assets` → 0).
- Live in `main`, all placeholders: `.github/workflows/ci.yml` ×2 = `BASE_ANON_KEY: REDACTED`; `.replit` ×3 = `REDACTED`-shaped JWT matches; `README.md` ×1 = `REDACTED`. 5 of 7 findings in deleted paths.
- `.env.qa.example` / `.env.production-demo.example`: every sensitive key holds an explicit placeholder (`replace…`, `your-…`), incl. `QA_ADMIN_PASSWORD` and the `postgresql://readonly-qa-user:replace-…@…` URL. `.gitignore` covers `.env`, `.env.*`, `.env.qa.*`, `.env.local`; only the two `.example` files are tracked.

**Scanner blind spots exposed by this exercise (worth encoding in policy):**
1. Both engines miss **commit-message / tag-message / PR-metadata** carriers; only `rev-list --pretty=fuller` + GitHub search find them.
2. Both engines missed this credential's **shape**: 40-char lowercase hex with no `sqp_`/`squ_`/`sqa_` prefix, and no keyword on the preceding line ("SONAR_CREDENTIAL_MARKER v1:") matched their rules.
3. `--redact` hides values in *reports* but does not stop a scanner from *missing* a finding. A keyword-based canary (`SONAR_CREDENTIAL_MARKER`, `rotate the token`) must be scanned for explicitly.

---

## 6. What was added (committed locally, **not pushed**)

| Path | Purpose |
| --- | --- |
| `scripts/security/verify-sonar-token-source.sh` | The 13-check gate above; `--static-only` for CI, full mode locally. Executes the shipped step via `GITHUB_ENV=$(mktemp)` so it can never write into a real runner env. |
| `scripts/security/extract-sonar-resolve-step.py` | Extracts the step under test (PyYAML, with a dependency-free fallback parser proven byte-identical) so the test cannot drift from the workflow. |
| `.github/workflows/sonar-workflow-guard.yml` | Runs the static gate on any PR/push touching `sonar.yml` or `scripts/security/**`; fails if a credential marker ever appears in tracked sources. `permissions: contents: read`, no secrets. |

It does **not** modify `.github/workflows/sonar.yml` — §1 confirms that change was already correct.

## 7. Optional hardening
- History scrub of the §2 commit message is *optional once the token is revoked*: `git filter-repo --message-callback 'return re.sub(rb"SONAR_CREDENTIAL_MARKER v1: [0-9a-f]{40}", b"SONAR_CREDENTIAL_MARKER v1: [REDACTED-REVOKED]", message)'` on a fresh mirror, then force-push. All commit SHAs change; every open PR, fork and clone retains the old object, so treat revocation — not scrubbing — as the actual control.
- Add a `gitleaks protect --staged` pre-commit hook plus `gitleaks detect --log-opts="--all"` scheduled weekly, with the metadata sweep from §5.
- GitHub Secret scanning is off for the owner plan checks here (403 on `security-manager`); enabling push protection would have blocked §2 had the value matched a known format.

## Residual CI hazard found while locking this in (2026-09-13): unfixed siblings of the timeout I patched

`tax-posting-history.test.ts` was failing CI because two `it.each` cases built a fresh
`createOfficeCreditorFixture` — a full uncached PGlite migration replay — inside the test body,
measured at 4,035 ms and 3,774 ms against vitest's 5,000 ms default. Fixed by moving those builds
into the file's existing `beforeAll` (420 s hook budget); assertions untouched.

Five cases share the same structure and are green today but have the same thin margin (worst case
measured **4,057 ms** against the same 5,000 ms default):

- `features/financials/expenses/owner-expense-source.test.ts:308,429,597` — all three replay to the
  **same** cut-off `20260909000011`, so one hoisted fixture could serve all three.
- `features/financials/reports/expense-correction-source-control.test.ts:285` — needs `…000010`,
  which differs from the file-level fixture's `…000011`, so it cannot share that database.
- `features/financials/reports/owner-receivable-reconciliation.test.ts:87` — needs `…000006`, likewise
  a distinct database.

Deliberately **not** changed in the same pass: no failure had been observed for these, and the fix
could not be validated under the project's real vitest config here — this sandbox is a 2 GB/2 CPU
container and the app config (`vite.config.ts`: PWA plugin, jsdom, worker pool) is OOM-killed by the
kernel for *any* suite (`dmesg`: `Out of memory: Killed process … (node (vitest))`, `SIGKILL`), which
is an environment limit and also exactly the "SIGKILL = INFRA, not app" rule recorded in `HANDOFF.md`.
`pnpm run typecheck` does pass here. A follow-up that lifts the three same-cut-off cases in
`owner-expense-source` into one `beforeAll` is mechanical and verifiable on a CI-sized runner; the two
different-cut-off cases should instead be given an explicit per-test timeout as `tax-posting-history`
already does.

Also noted while verifying: the inventory line *"Columns at scale 2 … identical set, none is money"*
was true for the ledger but missed `properties.current_value`, which the property form sends at
`MONEY_STEP = 0.001` and `optionalMoney` validates without a scale check — silent truncation
(`760000.123 → 760000.12`). `20260913000001_owner_valuation_omr_precision.sql` widens it to
`numeric(18,3)` per `DATABASE_RULES.md` ("Authoritative OMR money columns use numeric(18,3)"),
idempotently, with a postcondition. Not applied to any live database by this work.
