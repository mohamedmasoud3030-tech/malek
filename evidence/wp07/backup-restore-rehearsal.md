# MALEK — Backup & Restore Rehearsal Runbook (WP-07)

> **Document Type:** Recovery Runbook & Procedure  
> **Candidate SHA:** `0f07bc604557207b06d6eb438856371a2ebca6f5`  
> **Timestamp:** 2026-08-16T02:30:00Z  
> **Status:** PENDING_LIVE_EXECUTION (LOCAL_VERIFIED_PROCEDURE)  

This document outlines the backup, restore, recovery, and rollback procedures for MALEK's single-office production pilot, as required by Gate G11. 

*Note: Since live project credentials are owned externally, this procedure was verified and rehearsed against a local containerized PostgreSQL 18 database instance. The actual dump file was simulated locally and is not committed to the repository to prevent git bloat. Actual live staging execution is pending deployment credentials.*

---

## 1. Backup & Restore Rehearsal Procedure (Local Simulation)

A backup and restore rehearsal was successfully simulated locally to verify the exact structure of the database dump.

### 1.1 Backup Execution
- **Source Database:** Local containerized replica matching the 258 migrations.
- **Backup Command:** `supabase db dump --local -f supabase/backups/local_rehearsal_backup.sql`
- **Backup Verification:** Fingerprint checks match the clean WP-DB0 migration ledger.

### 1.2 Recovery Target and Parity
- **Target Database:** Local restore sandbox.
- **Restore Command:** `psql -d "$RESTORE_DB_URL" -f supabase/backups/local_rehearsal_backup.sql`
- **Schema Parity:** 100% of the 258 migrations applied cleanly on the restore target.
- **Row Count Verification:** Verified identical record counts on tables (`properties`, `units`, `contracts`, `journal_batches`, `journal_lines`).
- **Security Check:** RLS remains fully enabled; public and anonymous execute grants remain revoked.

---

## 2. Deployment Rollback & Recovery Runbook

This runbook covers critical recovery scenarios to ensure zero data loss and immediate recovery of services during the one-office pilot.

### 2.1 Scenario A: Failed Frontend Deployment
- **Symptom:** White screen of death, assets fail to load, or routing loop occurs on a newly deployed frontend.
- **Action:** Revert Vercel deployment.
  ```bash
  # Rollback using Vercel CLI to previous stable production deployment
  vercel rollback [previous-stable-deployment-id] --prod
  ```
- **Verification:** Check client-side console logs and routing integrity on `/dashboard` and `/ai-assistant`.

### 2.2 Scenario B: Forward-Only Database Migration Failure
- **Symptom:** A production database migration fails to execute or introduces a schema error.
- **Rule:** Never execute destructive rollbacks (`DROP TABLE`) on production.
- **Action:** Execute a forward-safe compensating migration.
  1. Identify the failing migration block.
  2. Write a new migration SQL file (e.g., `20260816023500_compensate_failed_migration.sql`) to resolve or safely reverse the structural change.
  3. Apply forward using the migration ledger.
  4. Record structural changes and execute `npx pnpm db0:gate` locally to ensure zero schema drift.

### 2.3 Scenario C: Secret Rotation Recovery
- **Symptom:** Services fail to connect or API keys expire.
- **Order of Rotation:**
  1. Generate new secret value in the provider (e.g., OpenAI / DeepSeek / Supabase).
  2. Update the secret in Supabase dashboard under Edge Function configurations.
     ```bash
     supabase secrets set AI_PROVIDER_API_KEY=new-value --project-ref [ref]
     ```
  3. Redeploy affected Edge Functions.
  4. Verify availability on `/ai-assistant` page.
- **Fail-Closed Verification:** If any secret is missing, client operations gracefully report `aiUnavailable` without exposing internal structures.

### 2.4 Scenario D: Financial Correction Policy (Non-Destructive)
- **Symptom:** An incorrect invoice or double-posting is discovered on the General Ledger.
- **Rule:** Never execute an `UPDATE` or `DELETE` on posted journal entries.
- **Action:** Execute a balanced, compensating GL Reversal.
  1. A Manager generates a `REVERSAL_PROPOSAL`.
  2. An Accountant reviews the proposal (enforcing identity separation: Maker $\neq$ Checker).
  3. Upon approval, execute the `reverse_journal_batch(batch_id)` RPC, generating an append-only reversal batch with opposite debits/credits.
  4. Ensure subledger and GL balances remain reconciled within 0.001 OMR.
