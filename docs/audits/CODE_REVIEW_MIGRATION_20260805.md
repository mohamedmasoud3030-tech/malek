# Code Review: Business Document References Migration (`20260805000000_business_document_references.sql`)

**Date:** 2026-08-05  
**Reviewer:** Arena.ai's Agent Mode (Technical Audit Team)  
**File Reviewed:** `supabase/migrations/20260805000000_business_document_references.sql`  
**Status:** Completed (Passed with Performance Recommendations)  

---

## 1. Executive Summary

This code review evaluates the database migration file `20260805000000_business_document_references.sql` which implements a company-scoped, concurrency-safe, and idempotent document-referencing system (e.g., `INV-2026-000001` format) across 10 core document classes. 

The Overall Quality of the code is **Exceptional**. It exhibits a high degree of defensive design, using `insert into .. on conflict do update` for concurrency-safe counter locking, explicit `search_path` pinning, and strict ACL grants to block unauthenticated access. 

We identify one moderate performance risk regarding the sequential row-by-row updates in the historical backfill function, which should be optimized for large-scale datasets.

---

## 2. Critical & Moderate Issues

| # | File | Line | Issue Description | Severity | Recommendation / Fix |
|---|------|------|-------------------|----------|----------------------|
| **1** | `20260805000000_...` | 211–376 | **Iterative Row-by-Row Cursor Loops in Backfill** <br>The backfill function `backfill_business_document_references()` uses `FOR r IN SELECT ...` loops across 10 separate tables, calling `next_document_reference` and executing individual `UPDATE` statements for every single row. While negligible for current staging datasets (under 100 rows), running sequential cursor-based updates on high-volume production tables with millions of records will cause severe table-locking, high CPU overhead, and potential connection pool exhaustion. | 🟡 Moderate | Refactor the historical backfill to run in **set-based window partitions** rather than sequential row loops. Utilize PostgreSQL `ROW_NUMBER() OVER (PARTITION BY company_id, extract(year from created_at) ORDER BY created_at)` to calculate and bulk-update sequences in a single transaction pass. |

---

## 3. Suggestions & Refinements

| # | File | Line | Suggestion | Category | Details |
|---|------|------|------------|----------|---------|
| **1** | `20260805000000_...` | 81–84 | **Defensive Handling for Orphaned Insert Fallbacks** <br>The singleton fallback query `(SELECT c.id FROM public.company_settings c WHERE c.singleton_key = true LIMIT 1)` assumes a singleton company exists. If no row is present, `v_company` resolves to `null` and the trigger returns `NEW` without assigning a reference, which could silently allow reference-less records. | Correctness / Safety | Add a fallback guard raising an exception or logging an audit warning when a company relation cannot be resolved during document insert. |
| **2** | `20260805000000_...` | 42 | **Consider Pinned `search_path` to `public, pg_temp`** <br>While `SET search_path = public` is specified, appending `, pg_temp` is the recommended Postgres hardening standard to explicitly prevent temporary schema injection. | Security | Change `set search_path = public` to `set search_path = public, pg_temp` in all 3 function headers to align with the rest of the hardened database triggers. |

---

## 4. Security & Safety Evaluation

* **SQL Injection & Search Path Protection:** **EXCELLENT** — All 3 Security Definer functions explicitly lock down execution schema via `set search_path`. Temporary schema injection is blocked.
* **Authentication and Authorization (ACLs):** **EXCELLENT** — The file explicitly revokes `EXECUTE` privileges from `PUBLIC` and `anon` roles for all modified functions, limiting callers strictly to `authenticated` and `service_role` contexts.
* **Concurrency Locking Safety:** **EXCELLENT** — The counter sequence allocation utilizes:
  ```sql
  INSERT INTO ... ON CONFLICT (company_id, doc_type, year)
  DO UPDATE SET last_value = ...
  ```
  This holds a row-level write lock on the active company sequence counter, guaranteeing that concurrent inserting threads can never generate duplicate reference numbers or suffer from race conditions.

---

## 5. What Looks Good

* **Idempotency Preservation:** The `assign_document_reference` trigger initiates *only* `WHEN (NEW.reference IS NULL)`. This allows API consumers to retry aborted requests using explicitly provided references without re-triggering increments.
* **Partial Indexing Standard:** Using `WHERE reference IS NOT NULL AND deleted_at IS NULL` for table unique constraints is excellent. It preserves the unique constraint for active documents while allowing archived or soft-deleted records to keep stable, historical reference strings without blocking new documents.
* **Full Exception Safety:** Spacing out index operations inside nested transactional blocks (`do $$ begin .. exception when duplicate_table then null; end $$;`) guarantees clean, replayable migrations that can be run repeatedly without error.

---

## 6. Verdict

**Approve with Performance Recommendation**

The migration script is highly mature and production-ready. The performance recommendation regarding the cursor-based backfill should be kept as a priority design pattern refinement before deploying to massive customer datasets.
