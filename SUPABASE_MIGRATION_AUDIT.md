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

## 5. Recommended owner yes/no (only for live apply)

**Recommended action:** after a restorable backup exists and the remote-only ledger versions are reconciled, apply **only** the additive index migration `20260831000000` (or the full replayed chain under a controlled release procedure) to the authorized QA project first.

| Impact | Faster company-scoped lists and relationship lookups |
| Cost | Index build time; disk; no row rewrite |
| Downtime | None expected with `IF NOT EXISTS` (may briefly lock on large tables if not concurrent — prefer maintenance window on huge tenants) |
| Risk | Low on empty/small QA; medium on large live without `CONCURRENTLY` (Postgres standard `CREATE INDEX` locks writes) |
| Rollback | Drop the named indexes |

**Do you approve applying the additive index migration to the authorized QA Supabase project?** (yes/no)

Until then, the migration ships in the repository and is proven on disposable PGlite only.

## 6. What was deliberately not done

- No Production `db push`.
- No destructive type conversion or backfill.
- No bulk indexing of all 84 remaining low-traffic FKs.
- No Auth Hook dashboard toggle (external).
- No rewrite of already-applied historical migration files.
