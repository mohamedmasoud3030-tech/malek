# MALEK Feature Rollout Policy

> **Version:** 1.1 — 2026-08-19  
> **Owner:** Platform  
> **Scope:** All feature flags defined in `rentrix-app/src/lib/feature-flag-definitions.json` — the single canonical inventory shared by the browser evaluator (`feature-flags.ts`) and the release guard (`scripts/check-expired-flags.mjs`)

---

## 1. Where flags help (and where they don't)

### ✅ Use a flag when:
- A change touches **financial calculations**, **ledger writes**, or **owner money**
- A change replaces a **read model** (dashboard snapshot, report aggregation)
- A change introduces a **new UI section or navigation item** that isn't ready for all offices
- A change requires a **one‑click rollback** without a full deploy

### ❌ Do NOT use a flag when:
- The change is a **bug fix** — ship it
- The change is a **permission rule** — enforce in RLS/RPC, not in a flag
- The change is **copy** (labels, error messages) — use i18n
- The change is a **tracking pixel or analytics tag** — ship it
- The change is a **database migration** — use migration-rollback, not a flag

> **Rule:** A flag is a temporary circuit breaker, not a permanent configuration knob.

---

## 2. Evaluation order (authoritative)

A flag is enabled for the current session only when **all** of these resolve to ON:

```
1. Known flag            — unknown key → OFF (fail closed)
2. Kill switch           — VITE_KILL_<NAME>=false → OFF (highest precedence)
3. Role eligibility      — roles gate fails closed for missing/unknown/unauthorized roles
4. Deployment override   — VITE_FEATURE_<NAME>=true → ON
5. Local preview         — localStorage ff:<name>=1|0 (staff only, after role gate)
6. Definition default    — defaultValue from the JSON
```

> **Security invariant:** role eligibility (step 3) is evaluated **before** any ON override, so a rollout env var can never expose a restricted feature to an unauthorized role. Flags are presentation controls only — never authorization.

> **Build-time note:** `VITE_*` values are browser build-time configuration in Vite. Changing them on Vercel **requires a rebuild/redeploy** before users receive the new bundle.

---

## 3. Flag lifecycle phases

```
idea → alpha → beta → stable → deprecated → removed
```

| Phase | Meaning | Who can see it | Cleanup requirement |
|-------|---------|---------------|-------------------|
| **alpha** | Experiment, may break | ADMIN only | Must have `cleanupBy` ≤ 4 weeks |
| **beta** | Validated, accepting trial | ADMIN + MANAGER | Must have `cleanupBy` ≤ 8 weeks |
| **stable** | On for everyone | All roles | No deadline (remove definition when code is permanent) |
| **deprecated** | Superseded, pending removal | All roles (if enabled) | Must be removed within one release cycle |

---

## 4. Flag inventory

| Key | Phase | Default | Roles | Owner | Cleanup by |
|-----|-------|---------|-------|-------|-----------|
| `ai-assistant` | beta | ON | ADMIN, MANAGER | platform | 2026-12-01 |
| `reports-v2` | alpha | OFF | ADMIN | platform | 2026-11-01 |
| `financial-wave-2` | alpha | OFF | ADMIN | platform | 2026-11-01 |
| `owner-agreements-v2` | alpha | OFF | ADMIN | platform | 2026-10-15 |
| `dashboard-v2` | alpha | OFF | ADMIN | platform | 2026-10-01 |
| `malek-pro-visual` | beta | ON | All | platform | 2026-09-15 |
| `commission-lifecycle-v2` | alpha | OFF | ADMIN, MANAGER | platform | 2026-10-01 |

---

## 5. Rollout stages

Every rollout follows these stages. Do not skip any.

### Stage 0 — Code complete
- [ ] Flag definition added to `feature-flag-definitions.json`
- [ ] Gated code reviewed (no auth bypass)
- [ ] Tests pass with flag OFF and ON
- [ ] Migration has rollback script

### Stage 1 — Alpha (ADMIN preview)
- [ ] Set `VITE_FEATURE_<KEY>=true` on the **QA/Preview** deployment
- [ ] Owner tests the feature
- [ ] No customer impact if broken (ADMIN only)
- **Duration:** 1–3 days

### Stage 2 — Beta (ADMIN + MANAGER)
- [ ] Change default to `true` OR set env var on **Production**
- [ ] Verify MANAGER can use it, USER cannot
- [ ] Verify kill switch works (`VITE_KILL_<KEY>=false` via Vercel dashboard)
- [ ] Monitor error rates for 48 hours
- **Duration:** 1 week

### Stage 3 — Stable (all roles)
- [ ] Remove role restriction from flag definition
- [ ] Set `defaultValue: true` if not already
- [ ] Announce to pilot offices
- [ ] Monitor for 1 full accounting cycle
- **Duration:** 2 weeks minimum

### Stage 4 — Cleanup
- [ ] Delete gated code (both branches)
- [ ] Remove flag definition from `feature-flag-definitions.json`
- [ ] Remove env var from Vercel dashboard (and redeploy)
- [ ] Test that the feature works without the flag
- [ ] Close the tracker issue

---

## 6. Observability

Each flag evaluation is intentionally **not logged** to avoid noise. Instead:

- **Pre‑release check**: `node scripts/check-expired-flags.mjs` (run before every deploy)
- **Contract test**: `feature-flags.test.ts` asserts every alpha/beta flag has a valid `cleanupBy`
- **Vercel dashboard**: Env vars `VITE_KILL_*` and `VITE_FEATURE_*` are visible in the deployment log

---

## 7. Kill switch procedure

If a flagged feature causes a production incident:

```
1. Go to Vercel Dashboard → Project → Environment Variables
2. Add `VITE_KILL_<KEY> = false` to the **Production** environment
3. Redeploy — the new value is baked into the next build
4. The feature is now OFF for all users
5. Confirm by checking the deployment log
```

No code change, no PR, no commit. Rollback in ≤ 5 minutes (one redeploy).

---

## 8. Cleanup enforcement

Every release must pass:

```bash
node scripts/check-expired-flags.mjs
```

If a flag has passed its `cleanupBy` date, the build fails.  Extend the date only when there is an explicit product decision and a new target date in the same PR.

---

## 9. Environment separation

| Environment | Flag source | Purpose |
|---|---|---|
| **Local dev** | `localStorage` (`ff:<name>=1|0`) | Fast per-session preview; never deployed |
| **QA / Preview** | `VITE_FEATURE_<NAME>=true` on the QA Vercel project | Owner validation before production |
| **Production** | `VITE_FEATURE_<NAME>` + `VITE_KILL_<NAME>` on the prod Vercel project | The only environment real users hit |

> `VITE_*` values are baked at build time and are **environment-scoped** by Vercel (each project has its own env vars), so QA and Production can differ. Never reuse a single Supabase project for QA and Production flag testing — QA uses the dedicated QA Supabase project (`QA_SUPABASE_PROJECT_REF`).

> **Role model:** the flag evaluator mirrors the full authorization role set (`ADMIN`, `MANAGER`, `ACCOUNTANT`, `OPERATIONS`, `USER`, `VIEWER` — from `domain/types.ts`), so any real role can be targeted and no real role is silently dropped to "unknown".

---

## 10. Percentage / gradual rollout

**Current decision: no percentage rollout.** Percentage rollout requires a **stable, trustworthy identity** (a consistent tenant/company key available at evaluation time). MALEK's multi-tenant identity is server-side (RLS via `current_company_id()`), not exposed as a stable client key in the bundle, so hashing a client value would produce unstable cohorts and is unsafe.

**Use the role gate instead** for staged exposure at this scale:
- `alpha` = ADMIN only, `beta` = ADMIN + MANAGER, `stable` = all roles.
- If finer-grained office-by-office rollout is ever needed, the correct approach is a **server-side flag column** (e.g. `company.feature_flags jsonb` read through a dedicated RPC), not a client hash.

---

## 11. Metrics and stop/rollback thresholds

Measure per flag during alpha/beta. Stop (kill switch) immediately when **any** of these triggers on Production:

| Signal | Threshold | Window |
|---|---|---|
| Browser error rate on gated surface | > 2% | rolling 1 hour |
| Failed financial/ledger RPCs | any non-zero | immediate |
| p95 latency regression on gated flow | > 2× baseline | rolling 24 hours |
| Support reports tied to the feature | 3 distinct offices | any |

**Rollback = kill switch** (`VITE_KILL_<NAME>=false` → redeploy). It is the one unconditional lever; all other actions (revert PR, re-run migration rollback) follow the normal incident process.

> Sources today: Vercel deployment logs, Supabase RPC error logs, and support channel. There is no product-analytics provider; if observability needs exceed what logs provide, that is the trigger to consider an external flag/analytics provider (see §12).

---

## 12. Provider recommendation

**Stay with the config-backed system.** At MALEK's current scale (single-digit flags, role-based staging, small office count), the JSON + Vite env + localStorage system is simpler, cheaper, and auditable in git. An external provider (LaunchDarkly / Flagsmith / PostHog flags) is justified only when **two or more** of these become true:

1. Need per-office or per-user percentage targeting with live (no-redeploy) control.
2. Need an audit trail of who changed which flag when.
3. Need real-time metric correlation per flag (kill on error-rate without human action).
4. Non-technical staff must toggle flags without a deploy.

If that day comes, prefer a provider with a **server-side SDK + RLS-friendly evaluation** and keep the same invariant: flags gate presentation, never authorization.

---

## 13. Ownership

| Flag | Owner | Backup |
|------|-------|--------|
| `ai-assistant` | @platform | @leads |
| `reports-v2` | @platform | @leads |
| `financial-wave-2` | @platform | @leads |
| `owner-agreements-v2` | @platform | @leads |
| `dashboard-v2` | @platform | @leads |
| `malek-pro-visual` | @platform | @leads |
| `commission-lifecycle-v2` | @platform | @leads |