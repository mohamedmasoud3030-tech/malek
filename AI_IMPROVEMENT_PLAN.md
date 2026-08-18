# MALEK — AI Improvement Plan

> Prioritized autonomous plan. External gates remain owner/credential dependent.  
> Status labels: `VERIFIED COMPLETE` | `IMPLEMENTED BUT NOT VERIFIED` | `BLOCKED BY OWNER/EXTERNAL ACTION` | `NOT STARTED`

## Recommended sequence (why this order)

1. **Stop user-facing install/SEO defects** that need no credentials.  
2. **Protect repository truth** (contracts/tests/docs) around those fixes.  
3. **Only then** tackle larger UX polish still fully local.  
4. **Never** invent live financial readiness; queue external gates clearly.  
5. **Defer** Master Lease productization and paid ops tooling until pilot path is unblocked.

This beats a menu of equal options because release risk is dominated by live money proof, while the only immediately shippable user pain found without credentials was install/public hygiene.

---

## Milestone A — PWA install icons + robots absolute sitemap

**Outcome:** iOS/Android can install MALEK with correct PNG icons; crawlers receive an absolute sitemap URL.  
**Acceptance:**

- manifest lists 192/512 any + maskable PNGs and keeps vector fallbacks;
- `apple-touch-icon` is 180×180 PNG;
- robots `Sitemap:` is absolute `https://malek-plus.vercel.app/sitemap.xml`;
- brand/sitemap contract tests pass;
- assets served 200 from dev server.

**Status:** repository path `VERIFIED COMPLETE` for contracts/build/precache; real-device install remains `IMPLEMENTED BUT NOT VERIFIED`.  
**Verification done:** 31 focused tests PASS; HTTP 200 for icons/manifest/robots; production build PASS; typecheck PASS; service-worker precache 29 unique URLs with install PNGs present once and no duplicates.  
**Remaining:** real iOS home-screen install check on deployed preview.

---

## Milestone B — Public first-visit honesty under missing backend config

**Outcome:** first visitor/login sees clear Arabic recovery when Supabase env is missing/placeholder, without technical leakage.  
**Status:** `VERIFIED COMPLETE` in repository for diagnostic detection + focused tests. Hosted production config remains an external concern.  
**Implementation:** `getEnvDiagnostics()` now flags placeholder/CI values via `env.isConfigured` and blocks the login affordance with safe Arabic copy.  
**Verification:** `runtime-diagnostics.test.ts` 3/3, login-page 11/11, env-validation 4/4, related unit/maintenance/shared-state suites PASS.

---

## Milestone C — Repository regression pack for public shell

**Outcome:** robots/manifest/apple-touch/PWA precache remain guarded in CI.  
**Status:** partially done inside Milestone A tests; expand if build/PWA precache assertions are thin.  
**Status label:** `IMPLEMENTED BUT NOT VERIFIED` at full CI level until broader suite/build run completes.

---

## Milestone D — Local production build + typecheck health

**Outcome:** confirm current branch still builds after icon/precache changes.  
**Status:** `VERIFIED COMPLETE` for this branch tip after Milestone A.

---

## Milestone E — UX empty/error consistency on high-traffic workspaces

**Outcome:** Money/Portfolio/Leasing empty and error states remain honest (no fake zeros) and mobile-safe.  
**Status:** `NOT STARTED` (many areas already good per scorecard).  
**Scope control:** only confirmed defects with evidence; no visual redesign for taste.

---

## Milestone F — Financial/security repository freeze checks

**Outcome:** re-run sensitive-write boundary, business-rules, migration hygiene, and a focused financial subset to ensure no accidental drift.  
**Status:** `NOT STARTED` this session.  
**Note:** not expected broken; confirmatory.

---

## External track (not autonomous)

| Gate | Status | Owner action |
|---|---|---|
| Hosted QA Auth/RLS/Storage exact-SHA proof | `BLOCKED BY OWNER/EXTERNAL ACTION` | QA credentials + approval |
| Backup/restore rehearsal | `BLOCKED BY OWNER/EXTERNAL ACTION` | infra access |
| Browser readiness on current SHA | `BLOCKED BY OWNER/EXTERNAL ACTION` | CI secrets / Playwright browser deps as available |
| Tax/legal profile activation | `BLOCKED BY OWNER/EXTERNAL ACTION` | professionals |
| One-office pilot | `BLOCKED BY OWNER/EXTERNAL ACTION` | pilot office + accountant |
| SonarCloud auto gate | `BLOCKED BY OWNER/EXTERNAL ACTION` | cost/process choice |
| S08 accounting approval → S09 | `BLOCKED BY OWNER/EXTERNAL ACTION` | accountant sign-off |

---

## Explicitly not in near plan

- Framework/auth/db rewrites.
- Enabling Master Lease as “IFRS complete”.
- Historical data correction.
- WhatsApp automated sending.
- Generic ERP modules.
- Renaming `rentrix-app` technical identifiers.
