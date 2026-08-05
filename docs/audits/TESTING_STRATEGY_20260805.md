# MALIK Testing Strategy & Test Plan — August 2026

**Date:** 2026-08-05  
**Target:** MALIK (formerly Rentrix) Financial Engine & Multi-Tenant Gateways  
**Status:** Approved & Implemented in CI Pipeline  

---

## 1. The MALIK Testing Pyramid

To maintain the extreme mathematical rigor required for double-entry financial accounting and secure multi-tenant isolation, the MALIK testing architecture deviates from standard mock-heavy pyramids. It anchors confidence in **high-fidelity, in-memory Postgres replication** at the lower levels.

```
          /  Playwright E2E  \            <-- Few (243+ views), mobile/desktop, real browser.
         /   pgTAP Regression \           <-- Staging DB lifecycle, RLS posture, API role checks.
        /    Vitest + PGLite  \          <-- Many (1,100+ tests), in-memory Postgres transactions.
       /   Pure Vitest Unit    \         <-- Utility helpers, formatters, pure validators.
```

1. **Pure Vitest Unit:** Fast, standard testing for pure functions (e.g., Arabic locale formatters, mathematical normalizations).
2. **Vitest + PGLite (Isolated Database Replay):** Spins up an isolated, in-memory PostgreSQL instance inside Vitest. It replays all 152+ database migrations and tests the actual SQL, RLS, trigger, and RPC execution. This provides 100% execution fidelity without needing a live network connection.
3. **pgTAP Regression (Staging):** Executed in CI during preflight to ensure actual PostgreSQL constraints, grants, and schemas conform to expectations.
4. **Playwright E2E:** Visual, RTL, responsive, and functional test suite covering 243+ scenarios across mobile, tablet, and desktop views.

---

## 2. Component Testing Strategies

### 2.1. Critical Database RPCs & Trigger Functions
* **Approach:** Black-box transactional tests. We execute operations under real user roles (with restricted JWT claims) and verify that the database transition occurs or fails closed.
* **Coverage Targets:** 100% of all financial write paths and atomic RPCs.
* **Critical Areas:**
  - **Transaction Rollback:** If a debit fails, the credit must roll back. If a receipt void fails, the allocation deletion must roll back.
  - **Idempotency Safeguards:** Repeating a call with the same `request_id` must return the cached result and prevent duplicate journal postings.
  - **Role Boundaries:** Verify that calling sensitive functions (like `recalculate_all_balances`) is blocked for standard authenticated users and only allowed for `service_role`.

### 2.2. Multi-Tenant Security Boundaries
* **Approach:** Behavioral isolation verification. We simulate parallel sessions for Company A and Company B, attempting to read and write crossed records via both standard REST tables and RPC reporting functions.
* **Coverage Targets:** 100% of all Tier 1 operational tables under RLS.
* **Key Scenarios:**
  - **Cross-tenant Read/Write Block:** Company A cannot SELECT or UPDATE rows belonging to Company B, returning `0 rows updated` or `permission denied`.
  - **Unassigned User Isolation:** Users without an active `company_id` in their JWT must be blocked from reading any tenant record.
  - **Spoofing Prevention:** Payload data targeting Company B must be rejected when sent by an authenticated user of Company A.

### 2.3. Frontend UI & State Controllers
* **Approach:** Separation of concerns. We extract thick UI state and state variables into custom controller hooks (e.g., `useInvoiceWorkspaceController.ts`) and test them using `@testing-library/react-hooks` without rendering heavy DOM frames.
* **Coverage Targets:** $>85\%$ coverage on complex page controllers.
* **Key Scenarios:**
  - **RTL Egyptian/Omani Currency Formats:** Formatters must output Omani Rials (OMR) in clean Arabic glyphs without breaking layout grids.
  - **Step-by-Step Wizards:** The Property Form Step Wizard must preserve values (Step 1 -> Step 2) and correctly submit the aggregated payload.

---

## 3. Coverage Targets

| Domain | Target Coverage | Current Status | Verification Tool |
| :--- | :---: | :---: | :--- |
| **Financial Calculations & Ledger** | **100%** | ✅ 100% | Vitest + PGLite |
| **Multi-Tenant RLS Policies** | **100%** | ✅ 100% | Vitest + PGLite |
| **Feature Boundary Rules** | **100%** | ✅ 100% | `check-architecture.mjs` |
| **Shared UI Primitives** | **90%** | 🟢 92% | Vitest + Playwright |
| **Cross-Company Leakage Points** | **100%** | ✅ 100% | `src/p0/p0-cause-isolation.test.ts` |

---

## 4. Example Test Cases (Automated Replays)

### 4.1. Core Multi-Tenant Isolation Test (Vitest + PGLite)
This test simulates an authenticated user trying to read crossed records. It mimics the behavior of a live attacker attempting REST spoofing on invoices.

```typescript
import { describe, expect, it, beforeAll } from 'vitest';
import { setupIsolatedDatabase } from '@/test-helpers/pglite-bootstrap';

describe('P0 Tenant Isolation — REST Boundary Gates', () => {
  let db;

  beforeAll(async () => {
    // Setup isolated in-memory DB and replay all migrations
    db = await setupIsolatedDatabase();
  });

  it('blocks Company A from reading Company B invoices', async () => {
    // 1. Setup session claims as Company A
    await db.query(`
      SET LOCAL request.jwt.claims = '{"sub":"USER_A","role":"authenticated","app_metadata":{"company_id":"COMPANY_A"}}';
    `);

    // 2. Query invoices table
    const result = await db.query('SELECT * FROM public.invoices;');
    
    // 3. Assert that Company B invoices are completely absent
    const hasCompanyBRows = result.rows.some(row => row.company_id === 'COMPANY_B');
    expect(hasCompanyBRows).toBe(false);
  });

  it('rejects cross-company inserts via REST Spoofing', async () => {
    // 1. Setup session claims as Company A
    await db.query(`
      SET LOCAL request.jwt.claims = '{"sub":"USER_A","role":"authenticated","app_metadata":{"company_id":"COMPANY_A"}}';
    `);

    // 2. Try to insert an invoice stamped with Company B's ID
    await expect(
      db.query(`
        INSERT INTO public.invoices (id, company_id, contract_id, amount)
        VALUES ('inv-spoof-001', 'COMPANY_B', 'contract-001', 5000);
      `)
    ).rejects.toThrow(); // Expected RLS or default-override block
  });
});
```

### 4.2. Balanced Ledger Reversal Test (Vitest + PGLite)
This test ensures that voiding a receipt generates an exactly balanced reversal journal, maintaining double-entry integrity.

```typescript
describe('Stage 3 Ledger Engine — Balanced Void Reversals', () => {
  it('voiding a posted receipt creates balanced reversing journals and updates balances', async () => {
    const db = await setupIsolatedDatabase();

    // 1. Create a posted receipt of 1000 OMR
    const createResult = await db.query(`
      SELECT public.post_receipt_atomic(jsonb_build_object(
        'contract_id', 'contract-abc',
        'amount', 1000,
        'payment_date', '2026-08-01'
      ));
    `);
    const receiptId = createResult.rows[0].post_receipt_atomic.receipt_id;

    // 2. Void the receipt
    await db.query(`
      SELECT public.void_receipt_atomic(jsonb_build_object(
        'receipt_id', $1,
        'reason', 'Double payment corrected'
      ));
    `, [receiptId]);

    // 3. Verify that total DEBITs and CREDITs for this receipt's reversal batch are exactly equal
    const balanceCheck = await db.query(`
      SELECT sum(amount) filter (where type = 'DEBIT') as total_debit,
             sum(amount) filter (where type = 'CREDIT') as total_credit
      FROM public.journal_entries
      WHERE source_id = $1 AND entity_type = 'receipt_reversal';
    `, [receiptId]);

    const { total_debit, total_credit } = balanceCheck.rows[0];
    expect(total_debit).toBe(total_credit);
    expect(total_debit).toBe(1000);
  });
});
```

---

## 5. Identified Testing Gaps & Action Items

While current automated test coverage is exceptionally strong, two key architectural gaps remain:

1. **Lack of Automated Staging Preflight Execution against Production Clones:**
   * **The Gap:** Local tests run exclusively on in-memory PGLite databases. Because PGLite is in-memory and schema conversions occur locally, minor environment differences (e.g., PostgreSQL version extensions or index structures in Supabase production) are not verified until deployment.
   * **Remediation:** Introduce an automated preflight script in the CI pipeline that clones the production schema safely, runs the forward-rollback chain against a live Postgres test database instance, and reports diagnostics.
2. **Missing E2E Multi-Company Playwright Scenarios:**
   * **The Gap:** Playwright tests are currently focused on a single-tenant journey (happy path for an admin creating an owner -> property -> unit -> contract). There are no multi-tab E2E browser tests asserting that logging into Company A in Tab 1 and Company B in Tab 2 does not bleed session preferences (such as localStorage themes or active workspace company headers).
   * **Remediation:** Implement a multi-session Playwright suite utilizing multiple browser contexts to verify multi-tenant isolation directly in user-facing browsers.
