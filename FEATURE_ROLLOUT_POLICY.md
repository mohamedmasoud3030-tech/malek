# MALEK Feature Rollout Policy

> **Version:** 1.1 — 2026-08-19  
> **Owner:** Platform  
> **Canonical inventory:** `rentrix-app/src/lib/feature-flag-definitions.json`

## 1. Security invariant

Feature flags are presentation and rollout controls only. They are **never authorization**. RLS, RPC permissions, route permissions, and backend validation remain authoritative for privileged operations.

A rollout source may decide whether an eligible user sees a feature, but it must never expand which roles are eligible.

## 2. Evaluation order

Every browser evaluation follows this fail-closed order:

```text
1. Unknown flag -> OFF
2. VITE_KILL_<KEY>=false -> force OFF
3. Role eligibility -> missing/unknown/unauthorized role => OFF
4. VITE_FEATURE_<KEY>=true -> ON for eligible roles
5. localStorage ff:<key>=1|0 -> local preview ON/OFF for eligible roles only
6. defaultValue
```

`localStorage` is user-controlled and must never be treated as trusted authorization state.

## 3. Vite/Vercel behavior

MALEK uses Vite. `VITE_*` variables are public browser build configuration and are embedded into the generated client bundle.

Therefore changing `VITE_FEATURE_*` or `VITE_KILL_*` in Vercel requires a deployment/rebuild before users receive the changed flag state. This is intentionally a lightweight deployment-level rollout system, not a runtime remote-config service.

No secret may be stored in a `VITE_*` variable.

## 4. When to use flags

Use a flag for temporary rollout of a new UI, read model, financial workflow surface, or other feature that needs staged exposure. Do not use flags for permissions, database migration safety, normal bug fixes, or backend authorization.

A flag is temporary. Alpha/beta flags require a cleanup date and must be removed when rollout is complete.

## 5. Lifecycle

```text
idea -> alpha -> beta -> stable -> deprecated -> removed
```

| Phase | Meaning | Typical audience | Cleanup requirement |
|---|---|---|---|
| alpha | Experimental | restricted roles | cleanup date required |
| beta | Validated trial | selected eligible roles | cleanup date required |
| stable | permanent behavior | intended roles | remove temporary flag when practical |
| deprecated | superseded | none/new path | remove within release cycle |

## 6. Current inventory

The JSON inventory is authoritative. This table is human-readable documentation only.

| Key | Phase | Default | Eligible roles | Cleanup by |
|---|---|---:|---|---|
| `ai-assistant` | beta | ON | ADMIN, MANAGER | 2026-12-01 |
| `reports-v2` | alpha | OFF | ADMIN | 2026-11-01 |
| `financial-wave-2` | alpha | OFF | ADMIN | 2026-11-01 |
| `owner-agreements-v2` | alpha | OFF | ADMIN | 2026-10-15 |
| `dashboard-v2` | alpha | OFF | ADMIN | 2026-10-01 |
| `malek-pro-visual` | beta | ON | ADMIN, MANAGER, USER | 2026-09-15 |
| `commission-lifecycle-v2` | alpha | OFF | ADMIN, MANAGER | 2026-10-01 |

## 7. Rollout stages

### Stage 0 — Code complete
- [ ] Add/update the canonical JSON definition.
- [ ] Confirm no backend authorization relies on a feature flag.
- [ ] Test OFF, ON, unauthorized-role, unresolved-role, and kill-switch paths.
- [ ] Keep migrations and their rollback strategy independent from flags.

### Stage 1 — QA/Preview
- [ ] Set `VITE_FEATURE_<KEY>=true` in the QA/Preview environment.
- [ ] Deploy/rebuild that environment.
- [ ] Verify only eligible roles can see the feature.

### Stage 2 — Production beta
- [ ] Set the production rollout value or intentionally change the default.
- [ ] Deploy/rebuild Production.
- [ ] Verify eligible and ineligible roles explicitly.
- [ ] Verify the kill-switch path on a non-production environment before relying on it operationally.

### Stage 3 — Stable
- [ ] Finalize intended role eligibility.
- [ ] Make permanent behavior explicit.
- [ ] Remove temporary rollout branches when the feature no longer needs a flag.

### Stage 4 — Cleanup
- [ ] Delete dead gated code.
- [ ] Remove the canonical definition when the flag is no longer needed.
- [ ] Remove obsolete Vercel environment variables.
- [ ] Re-run all release gates.

## 8. Kill-switch procedure

If a flagged browser feature causes an incident:

```text
1. Vercel Dashboard -> Project -> Environment Variables
2. Set VITE_KILL_<KEY>=false for the affected environment
3. Trigger a deployment/rebuild
4. Verify the new deployment is serving the updated bundle
5. Confirm the feature is OFF for eligible and ineligible roles
```

This requires no source-code change, PR, or commit, but it **does require a new browser deployment/build**. It is not an instantaneous server-side remote switch.

For risks that require a truly immediate server-side stop, use backend authorization/configuration or an operational circuit breaker designed for that purpose; do not rely on a Vite client flag.

## 9. Cleanup enforcement

Every PR/release gate must run:

```bash
pnpm check:expired-flags
```

The checker reads the same canonical JSON inventory used by the browser flag system. An expired alpha/beta flag blocks the gate until it is removed or its cleanup date is explicitly extended with a product decision.
