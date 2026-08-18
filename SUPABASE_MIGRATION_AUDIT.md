# Supabase Migration Audit

Generated: 2026-08-18  
Local chain: **282** SQL files, `20250101000001_core_schema.sql` … `20260831000000_hot_path_fk_covering_indexes.sql`.  
Replay: **282 / 282 applied** into disposable PGlite (`scripts/supabase-tests/schema-inventory.mjs`).  
Live ledger: **Not verifiable remotely** (sandbox outbound TLS blocked). Historical read-only evidence: `evidence/preflight/production_live_reconciliation_20260721.md` (project `nnggcnpcuomwfuupupwg`).

## 1. How to read the statuses

| Status | Meaning |
|---|---|
| Confirmed | Proven in this sandbox (PGlite replay or repository file contents) |
| Probable | Strong repo evidence; not re-proven against Production |
| Not verifiable remotely | Needs hosted read-only credentials / network egress |

Every file after the 2026-07-21 live snapshot remains **unapplied from this sandbox’s point of view** until an authorized hosted apply is performed. Do not push the full chain as a blind batch onto Production.

## 2. Live ledger (Not verifiable remotely)

As of 2026-07-21 the hosted ledger:

- Had **10 remote-only versions** (5 executable aliases with different timestamps, 5 Production-only historical fixes).
- Was missing three then-local files (since expanded substantially).
- Blocked automatic Production deploy with: `Remote migration versions not found in local migrations directory.`
- Organization is on the **Free plan** — no downloadable managed backup, no restore rehearsal.

Merging a ledger-reconciliation without a restorable backup could auto-apply every remaining local-only migration. That is why Production writes stay **HOLD / NO-GO**.

## 3. Classification of migrations

### SAFE (additive only — still require authorized apply on live)

Index-only, new tables with RLS, new catalog rows, new SECURITY DEFINER RPCs that fail closed, check constraints that add values.

**This pass added:**

| File | Class | Notes |
|---|---|---|
| `20260831000000_hot_path_fk_covering_indexes.sql` | **SAFE / additive** | `CREATE INDEX IF NOT EXISTS` only; covers company_id on operational tables + receipt/settlement/maintenance reverse keys. Replay: 282/282, indexes 401, hot-path unindexed FKs **0**. Hygiene guard: OK. |

Other historical SAFE examples:

- `20260820090000_rc1_release_integration_fk_indexes.sql` — index-only
- `20260821000000_r1_dashboard_truth_read_model.sql` — read model
- `20260830020000_ai_assistant_abuse_controls.sql` — rate-limit table + controls

Safe in isolation does **not** mean safe to apply onto a drifted Production ledger without ledger reconciliation.

### REQUIRES CARE (function replace, policy replace, backfill, constraint swap)

Most of the 2026-07-22 multi-tenant series and the August hardening chain (company backfill, Auth hook, RPC isolation, storage/RLS rewrite, financial sealing, precision/tax/accruals, maintenance lifecycle). See prior full group table in git history / Document 7 gaps.

### DESTRUCTIVE / do not apply from an agent without owner approval

Files containing `DROP TABLE`, `DROP COLUMN`, or `ALTER … TYPE` remain out of autonomous Production apply until a restorable backup exists and each file is reviewed against live row shapes. Representative set unchanged from the previous audit (`20260724120000`, `20260725000000`, `20260815010000`, type-reconciliation files, OMR precision wideners, etc.).

## 4. This session

| Item | Decision |
|---|---|
| New migration | **Yes — index-only** `20260831000000_hot_path_fk_covering_indexes.sql` |
| Applied to Production | **No** |
| Applied to PGlite replay | **Yes** (inventory 282/282) |
| Rollback | `DROP INDEX IF EXISTS` for each named index (no data loss) |
| Hygiene guard | OK (base `origin/main`) |

## 5. Owner approval and apply status

**Owner decision:** **YES** — apply additive index migration to authorized QA project only.

| Field | Status |
|---|---|
| Approval recorded | 2026-08-18 — owner replied «موافق» |
| Intended target | Supabase project `nnggcnpcuomwfuupupwg` (treated as QA for this session) |
| Agent remote apply | **BLOCKED BY ENVIRONMENT** — sandbox outbound HTTPS TLS fails (`SSL_ERROR_SYSCALL` / handshake EOF) to `api.supabase.com` and `*.supabase.co` |
| Repository / PGlite proof | **VERIFIED** — 282/282 migrations, 401 indexes, hot-path unindexed FK = 0 |
| Ready-to-run pack | `evidence/qa-index-apply/` (SQL + verify + rollback + README) |
| Production apply | **Not approved / not attempted** |

### How to finish the approved QA apply (one-time, SQL Editor)

1. Supabase Dashboard → project `nnggcnpcuomwfuupupwg` → **SQL Editor**.
2. Run `evidence/qa-index-apply/20260831000000_hot_path_fk_covering_indexes.sql`.
3. Run `evidence/qa-index-apply/VERIFY_AFTER_APPLY.sql` — expect `hot_path_indexes_present = 24`.
4. If anything is wrong, run `evidence/qa-index-apply/ROLLBACK.sql`.

Do **not** run a full history `db push` until remote-only ledger versions are reconciled.

| Impact | Faster company-scoped lists and relationship lookups |
| Cost | Index build time; disk; no row rewrite |
| Downtime | None expected with `IF NOT EXISTS` (may briefly lock writes on large tables) |
| Risk | Low on small/empty QA; schedule a quiet window if QA is already large |
| Rollback | `evidence/qa-index-apply/ROLLBACK.sql` |

## 6. What was deliberately not done

- No Production `db push`.
- No destructive type conversion or backfill.
- No bulk indexing of all 84 remaining low-traffic FKs.
- No Auth Hook dashboard toggle (external).
- No rewrite of already-applied historical migration files.
