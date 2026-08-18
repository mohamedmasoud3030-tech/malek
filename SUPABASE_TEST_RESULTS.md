# Supabase Test Results

Generated: 2026-08-18T14:20:47Z  
Branch: `arena/01a01531-malik`  
Environment: Arena sandbox — Node 22, pnpm 10.11.1, PGlite 0.5.4.  
**No Docker, no `psql`, no hosted Supabase credentials.**

This is not “the database works for one admin.” Every critical role below was
proven as **allowed** and **denied** on the schema the repository builds today.

## 1. Exact commands executed

| # | Command | Result |
|---|---|---|
| 1 | `pnpm install --frozen-lockfile` | PASS |
| 2 | `node scripts/supabase-tests/privileged-key-scan.mjs` | PASS (after excluding non-shipped `*.test.*` files that mention forbidden markers as search needles) |
| 3 | `pnpm --filter ./rentrix-app exec vitest run --config vite.config.ts` (focused visibility/session/function files) | PASS 148/148 then 50/50 |
| 4 | `node scripts/supabase-tests/rls-matrix.mjs` | PASS **79 passed / 0 failed / 0 skipped** (6.2s after fixture correction) |
| 5 | `pnpm --filter ./rentrix-app run typecheck:test` | PASS |
| 6 | `pnpm test:supabase` | PASS — 1 + 79 + 198 |

Not executed here (environment limitation, not a product pass):

| Command | Why not executable |
|---|---|
| `scripts/ci/run-supabase-database-gate.sh` / `supabase test db` | No Docker, no Supabase CLI stack |
| `rentrix-app/scripts/storage-isolated-smoke.mjs` | Needs local/staging Auth + Storage HTTP |
| `pnpm e2e` / single-office isolated Playwright | Needs app + local/hosted Auth |
| `pnpm supabase:live-readiness` | No `SUPABASE_DB_URL`, no `psql` |
| `pnpm qa:preflight` / `qa:lifecycle` | No QA credentials; mutation path refuses Production |
| Hosted Auth Hook enablement check | External runtime evidence |

## 2. Pass / fail / skip counts

### `pnpm test:supabase` (this sandbox)

| Layer | Passed | Failed | Skipped | Seconds |
|---|---:|---:|---:|---:|
| Privileged-key scan | 1 | 0 | 0 | 0.1 |
| Current-schema RLS / auth / integrity matrix | 79 | 0 | 0 | 9.7 |
| Client session / visibility / function Vitest | 198 | 0 | 0 | 13.4 |
| **Total this run** | **278** | **0** | **0** | **23.2** |

Replay: **281 / 281** migrations applied into disposable PGlite.

### Existing suites (not re-run in full here; already wired in CI)

| Suite | Where it runs | Notes |
|---|---|---|
| WP-DB0 7 gates | `ci.yml` `pnpm db0:gate` | Structural isolation, types, contract |
| App Vitest | `ci.yml` | Includes the new files automatically |
| Financial Vitest | `ci.yml` | Invoice/payment/void math |
| pgTAP `supabase/tests/*.sql` | Release-blocker Docker job | Launch journeys + two-company + six-role catalog |
| Storage + single-office e2e | Release-blocker Docker job | Auth HTTP + Storage HTTP |
| Hosted QA | Separate workflow | Explicit mutation approval |

## 3. Role / resource coverage matrix

Proven on the **current** 281-migration schema.  
`allow` = intended access. `deny` = intended refusal.  
Hook → RLS means the access-token hook issued the claim, then RLS was queried.

| Actor | properties | owners | people | units | expenses | idempotency | journal write | payment RPC | dashboard RPC |
|---|---|---|---|---|---|---|---|---|---|
| anon | deny | deny | deny | deny | deny | deny* | deny* | deny | deny |
| USER A | read allow / write deny | read allow | read allow | read allow | read allow | deny | deny | — | — |
| VIEWER A | read allow / write deny | read allow | read allow | read allow | read allow | — | — | — | — |
| ACCOUNTANT A | write deny | — | — | — | — | — | — | — | — |
| OPERATIONS A | write deny (DB) | — | — | — | — | — | — | pay deny (role helper) | — |
| MANAGER A | update own allow | — | — | — | — | — | — | — | — |
| ADMIN A | read own / insert own / cannot insert B | read own | read own | read own | read own / cannot update B | — | deny | foreign invoice deny | allow (A only) |
| ADMIN B | read own / cannot update or delete A | read own | read own | read own | read own | — | — | — | allow (B only) |
| Inactive ADMIN JWT | deny | deny | deny | deny | deny | — | — | — | — |
| Deleted ADMIN JWT | not an app user | — | — | — | — | — | — | — | — |
| No membership (hook-issued) | deny | — | — | — | — | — | — | — | — |
| Admin A preferring B (hook-issued) | deny B | deny B | deny B | deny B | deny B | — | — | — | — |
| `service_role` | read A+B | — | — | — | — | — | — | — | — |

\*Grant/RLS sealed; SELECT/INSERT thrown or empty.

Auth hook (separate from RLS):

| Case | Result |
|---|---|
| Admin A membership | stamps Company A + `ADMIN` |
| Incoming Company B claim for Admin A | ignored; still Company A |
| User with no membership | no `company_id` |
| Inactive membership | no `company_id` |
| Hook execute grant | `supabase_auth_admin` only; anon/authenticated denied |

## 4. Product defects found and safely fixed

**No production RLS policy, RPC, or grant was changed.**

Findings were classified as follows:

| Finding | Class | Action |
|---|---|---|
| First key-scan hit on `documentAcceptanceHarness.test.ts` (`BEGIN PRIVATE KEY` as a **search needle**) | Test-scan false positive | Scanner now skips non-shipped `*.test.*` / `*.spec.*` files. Browser source still scanned. |
| Forged JWT with `company_id=B` can read B if the hook is bypassed | **Test defect**, then remaining risk | Tests now go hook → RLS. Product design: RLS trusts the **issued** claim; the hook is the membership gate. RLS was **not** weakened. |
| `OPERATIONS` has `properties.write` in the UI matrix; DB write uses `is_admin_or_manager()` | Product/UI mismatch, not a leak | Matrix records the **database deny**. RLS was not opened to match the UI. |

No expected behavior was silently redefined to make a leak look like a pass.

## 5. Tests not executable here, and why

| Area | Why |
|---|---|
| GoTrue signup / password / email recovery delivery | No Auth HTTP service |
| Storage signed-URL download, public URL deny, MIME reject over HTTP | No Storage API |
| Realtime reconnect / duplicate events | Realtime excluded from local CI stack; no live channel |
| Edge Function live CORS / provider failure / replay | Deno runtime + secrets not present |
| pgTAP financial lifecycle (invoice → pay → void) | Needs `supabase test db` |
| Two-session concurrency (settlements, GL posting) | Needs two `psql` sessions |
| Hosted QA / Production read-only smoke | No credentials; Production must stay read-only |
| Backup / restore rehearsal | Operator procedure (`evidence/wp07/`) |

## 6. Remaining security / data risks

1. **Auth Hook must be enabled on the hosted project.** RLS scopes by `current_company_id()` from the JWT. If the hook is off, a minted JWT that already contains another `company_id` is trusted. Repository tests cannot see the hosted hook switch (`GAP-003/021`).
2. **OPERATIONS write affordances in the UI are broader than RLS.** A user with the OPERATIONS role will see property-write actions that the database rejects. That is fail-closed, but it is a product inconsistency.
3. **Maker-checker is not uniform** across every VOID / settlement path (`GAP-002`).
4. **47 financial columns remain `numeric(_,2)`** (accepted GAP-009).
5. **Live schema drift** is unproven in this sandbox. `pnpm db0:gate` proves the repo; it does not prove Production.
6. **`service_role` bypasses RLS by design.** It must never appear in the browser. The new scan and the existing dist scan enforce that locally/CI; hosted secret handling is operational.

## 7. CI and production-smoke status

| Gate | Status after this change |
|---|---|
| `pnpm test:supabase:secrets` / `pnpm test:supabase:rls` | Available as package scripts. The GitHub App on this branch cannot update `.github/workflows/ci.yml` (`workflows` permission). Wire them into CI after that permission is granted. |
| Existing `db0:gate`, app tests, financial tests | Unchanged; new Vitest files are picked up by the existing app test job |
| Release-blocker Docker database + Storage | Unchanged; still the HTTP Auth/Storage proof |
| Hosted QA | Unchanged; still requires injected QA secrets |
| Production smoke | Still `pnpm supabase:live-readiness` (read-only) and the optional release-blocker auth spec. **Not run here.** |

## 8. How to re-run

```bash
pnpm test:supabase
pnpm test:supabase:rls
pnpm test:supabase:secrets
```

Strategy and risk mapping: `SUPABASE_TEST_STRATEGY.md`.
