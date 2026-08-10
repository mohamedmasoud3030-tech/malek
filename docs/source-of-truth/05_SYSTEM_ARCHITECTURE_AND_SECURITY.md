# MALEK Canonical Pack — Document 5: System Architecture and Security

> **Status:** CANONICAL  
> **Rule ID Prefix:** SEC-###  
> **Effective Date:** 2026-08-10

---

## 1. Architecture Overview

### 1.1 Technology Stack

**SEC-101 — Frontend**

| Component | Technology |
|-----------|------------|
| Framework | React 19 with TypeScript |
| Build Tool | Vite |
| Routing | TanStack Router |
| Styling | Tailwind CSS v4 |
| Icons | Lucide React |
| State | React hooks + context |
| Testing | Vitest, Playwright |

**SEC-102 — Backend**

| Component | Technology |
|-----------|------------|
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth |
| API | Supabase client + RPCs |
| Edge Functions | Supabase Edge Functions (future) |
| Storage | Supabase Storage |

**SEC-103 — Repository Structure**

```
malik/
├── rentrix-app/           # Frontend application
│   ├── src/
│   │   ├── features/      # Feature modules
│   │   ├── components/    # Shared components
│   │   ├── routes/        # TanStack Router routes
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and services
│   │   └── domain/        # Domain types and validators
│   └── tests/             # Test files
├── supabase/
│   ├── migrations/        # Database migrations
│   ├── rollback/           # Rollback scripts
│   └── tests/              # Database tests
├── docs/                   # Documentation
└── governance/             # Governance files
```

---

## 2. Multi-Tenant Isolation

### 2.1 Company Boundary

**SEC-201 — Company as Tenant Unit**

Every operational table contains `company_id` establishing the tenant boundary.

**SEC-202 — JWT Company Selection**

The active company is resolved from Supabase Auth JWT claims:
```sql
-- In JWT app_metadata:
{ "company_id": "uuid" }

-- Resolution function:
current_company_id() → company_id
```

**SEC-203 — Multi-Company Membership**

Users may belong to multiple companies via `company_memberships`. Active company is:
- Selected at login
- Switchable via company switcher UI
- Persisted in session

---

## 3. Row-Level Security (RLS)

### 3.1 RLS Implementation

**SEC-301 — Isolation Policy Pattern**

```sql
-- Example: properties table
CREATE POLICY tenant_isolation_policy ON properties
AS RESTRICTIVE
USING (company_id = current_company_id())
WITH CHECK (company_id = current_company_id());
```

**SEC-302 — RESTRICTIVE Keyword**

All isolation policies use `AS RESTRICTIVE` to ensure they cannot be bypassed by other permissive policies.

**SEC-303 — RLS Status**

RLS is enabled on all operational tables. Verification:
- `20260807232413_harden_rls_membership_and_invoker_helpers.sql`
- `20260807233732_harden_company_membership_rls_authority.sql`

**SEC-304 — Performance Advisories**

224 open advisories exist including:
- `auth_rsl_initplan`
- `multiple_permissive_policies`

These are logged for future optimization; do not indicate security failures.

---

## 4. Permission Model

### 4.1 Role Hierarchy

**SEC-401 — Product Roles (ADR 0015)**

| Role | Description |
|------|-------------|
| ADMIN | Full system access, settings, user management |
| MANAGER | Operational access, approvals |
| ACCOUNTANT | Financial access, reporting |
| OPERATIONS | Day-to-day operational tasks |
| USER | Basic operational access |
| VIEWER | Read-only access |

**SEC-402 — Code vs. Document Discrepancy**

- **Code:** Currently implements 3 roles (ADMIN, MANAGER, USER)
- **Documents:** Specify 6 roles (ADR 0003, ADR 0015)
- **Status:** CONFLICT — 6-role model approved but 3-role implementation exists
- **Resolution:** Expand permission tables (OD-04 pending)

### 4.2 Permission Definitions

**SEC-403 — Permission File**

Permissions defined in: `rentrix-app/src/features/auth/permissions.ts`

| Permission | Description |
|------------|-------------|
| `properties.create` | Create properties |
| `properties.edit` | Edit properties |
| `properties.archive` | Archive properties |
| `units.create` | Create units |
| `contracts.create` | Create contracts |
| `contracts.activate` | Activate contracts |
| `contracts.terminate` | Terminate contracts |
| `receipts.create` | Record receipts |
| `receipts.void` | Void receipts |
| `expenses.view` | View expenses |
| `expenses.create` | Create expenses |
| `financial.deposits.view` | View deposits |
| `financial.owner_settlements.view` | View settlements |
| `financial.bank_reconciliation.view` | View reconciliation |
| `arrears.view` | View arrears |

### 4.3 Effective Permission Evaluation

**SEC-411 — Permission Check Flow**

1. Extract user role from JWT
2. Load permission grants for role
3. Check permission against action required
4. Return allow/deny

**SEC-412 — UI Permission Gates**

UI elements conditionally render based on permissions:
- Hidden actions not in user's permission set
- Disabled buttons for unauthorized actions
- Redirect for unauthorized routes

---

## 5. Financial Write Boundaries

### 5.1 Browser as Untrusted Client

**SEC-501 — Trust Model**

The browser client is **untrusted** for all financial mutations:
- No direct INSERT/UPDATE/DELETE on financial tables
- All mutations through RPC-only paths
- RLS blocks direct client writes

### 5.2 SECURITY DEFINER RPCs

**SEC-502 — RPC Pattern**

All financial mutations use `SECURITY DEFINER` functions:

```sql
CREATE FUNCTION create_receipt_atomic(...)
RETURNS ... AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get company from session
  v_company_id := require_company_id();
  
  -- Validate inputs
  -- Derive amounts server-side
  -- Create journal entries
  -- Return result
  
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```

**SEC-503 — Required Attributes**

| Attribute | Purpose |
|-----------|---------|
| `SECURITY DEFINER` | Execute with definer's privileges |
| `SET search_path = public, pg_temp` | Prevent search_path attacks |
| `require_company_id()` | Extract company from JWT |
| `SELECT ... FOR UPDATE` | Lock rows for update |
| Idempotency check | Prevent duplicate operations |

### 5.3 Direct Write Hardening

**SEC-504 — Financial Tables**

| Table | Direct Write Status |
|-------|---------------------|
| `receipts` | Blocked (RPC-only after S02) |
| `payments` | Blocked (RPC-only after S02) |
| `commissions` | Blocked (RPC-only after S02) |
| `accounts` | Blocked (browser writes closed) |
| `journal_lines` | Blocked (engine-only) |
| `journal_batches` | Blocked (engine-only) |

Evidence: `20260807010000_s02_remove_residual_fancial_write_policies.sql`

---

## 6. Service and RPC Boundaries

### 6.1 RPC Inventory

**SEC-601 — Core Financial RPCs**

| RPC | Purpose | Status |
|-----|---------|--------|
| `create_contract_atomic` | Contract creation with validation | VERIFIED |
| `update_contract_atomic` | Contract updates | VERIFIED |
| `terminate_contract_atomic` | Contract termination | VERIFIED |
| `renew_contract_atomic` | Contract renewal | VERIFIED |
| `record_invoice_payment_atomic` | Record payment | VERIFIED |
| `void_receipt_atomic` | Void receipt | PARTIAL (Maker-Checker pending) |
| `create_expense_with_journal_atomic` | Expense creation | VERIFIED |
| `create_commission_atomic` | Commission creation | VERIFIED |
| `pay_commission_atomic` | Commission payment | VERIFIED |
| `reverse_commission_atomic` | Commission reversal | VERIFIED |
| `post_journal_event` | GL posting | IMPLEMENTED_UNVERIFIED |
| `create_bank_import_batch` | Bank CSV import | IMPLEMENTED_UNVERIFIED |
| `update_owner_agreement_atomic` | Agreement updates | PARTIAL (company isolation) |

### 6.2 RPC Company Isolation

**SEC-602 — Required Pattern**

All RPCs that modify existing records:
```sql
WHERE id = p_id
  AND company_id = v_company_id
FOR UPDATE
```

Non-existent records and cross-company records return appropriate errors without data leakage.

---

## 7. Authentication and Authorization

### 7.1 Auth Flow

**SEC-701 — Authentication**

- Supabase Auth for user authentication
- Email/password or magic link
- JWT tokens with 1-hour expiry
- Refresh tokens for session continuation

**SEC-702 — Authorization Context**

JWT contains:
```json
{
  "sub": "user_id",
  "role": "authenticated",
  "app_metadata": {
    "company_id": "uuid",
    "company_ids": ["uuid1", "uuid2"],
    "role": "ADMIN"
  }
}
```

### 7.2 Write-Access Request Lifecycle

**SEC-711 — Permission Request Workflow**

1. User requests elevated permission
2. Request recorded with reason
3. ADMIN reviews request
4. ADMIN approves or rejects
5. Permission granted/revoked

Evidence: `20260809030000_permission_request_workflow.sql`

---

## 8. Audit Logging

### 8.1 Audit Events

**SEC-801 — Tracked Events**

| Event Type | Examples |
|------------|----------|
| Entity CRUD | property.created, contract.activated |
| Financial | receipt.created, receipt.voided |
| Permission | permission.granted, permission.revoked |
| System | user.login, user.logout |

**SEC-802 — Audit Record**

Each event stores:
- `id`: UUID
- `user_id`: Actor
- `action`: Event type
- `entity_type`: Target entity
- `entity_id`: Target ID
- `timestamp`: Event time
- `details`: JSON metadata
- `company_id`: Company scope

---

## 9. Error Handling

### 9.1 Error Codes

**SEC-901 — SQLSTATE Conventions**

| Code | Meaning |
|------|---------|
| 22023 | Idempotency violation |
| 23505 | Unique constraint violation |
| 23503 | Foreign key violation |
| P0001 | Custom business rule violation |

**SEC-902 — Error Propagation**

Errors from RPCs are:
1. Caught and formatted in service layer
2. Translated to user-friendly messages (Arabic)
3. Displayed in UI with context

---

## 10. Storage and Documents

### 10.1 Document Storage

**SEC-1001 — Supabase Storage**

Documents stored in Supabase Storage buckets:
- `property-documents`
- `contract-documents`
- `tenant-documents`

**SEC-1002 — Access Control**

- Storage rules enforce company isolation
- Pre-signed URLs for temporary access
- MIME type validation (5MB max for contracts)

---

## 11. Observability and Risks

### 11.1 Implemented Controls

**SEC-1101 — Verified Controls**

| Control | Evidence |
|---------|----------|
| RLS company isolation | Migrations and tests |
| Financial RPC-only writes | S02 hardening migrations |
| Idempotency guards | financial_operation_idempotency table |
| JWT company selection | multi_company_jwt_selection.sql |
| Permission model | permissions.ts + role checks |

### 11.2 Controls Requiring Verification

**SEC-1111 — Runtime Verification Needed**

| Control | Status |
|---------|--------|
| Live RLS enforcement | Requires hosted environment |
| Auth hook behavior | Requires production config |
| Edge function security | Not deployed yet |
| Production secrets | Not accessible in repo |

### 11.3 Missing/Conflicting Controls

**SEC-1121 — Identified Gaps**

| Gap | Impact | Status |
|-----|--------|--------|
| 6-role model not implemented | Permission granularity insufficient | CONFLICT |
| FGR-006 approval flow | Bank reconciliation incomplete | PARTIAL |
| Maker-Checker for voids | Void self-approval possible | PARTIAL |
| Maintenance RPC hardening | Direct writes still possible | BLOCKED_INCOMPLETE_RPC |

---

## 12. Architecture Verification Evidence

### 12.1 Verified in Code

- Repository layout
- React/Vite/TypeScript stack
- TanStack Router configuration
- Component structure
- RLS policy definitions
- RPC function signatures
- Permission model structure

### 12.2 Claimed Only in Documents

- Live RLS enforcement (needs hosted environment)
- Production secrets and configuration
- Auth hook behavior
- Edge function deployment status

### 12.3 Runtime Dependencies

The following cannot be verified from repository alone:
- Supabase project configuration
- Live Auth Hooks
- Production environment variables
- Deployed Edge Functions
- CDN configuration

---

## 13. Implementation Status Summary

| Component | Status | Evidence |
|-----------|--------|----------|
| Multi-tenant RLS | VERIFIED_COMPLETE | Migrations, tests |
| JWT company selection | VERIFIED_COMPLETE | multi_company_jwt_selection.sql |
| Financial RPC-only | VERIFIED_COMPLETE | S02 hardening |
| Permission model | PARTIAL | 3 roles vs 6 required |
| Audit logging | PARTIAL | Basic events; full coverage planned |
| Idempotency | VERIFIED_COMPLETE | financial_operation_idempotency |
| Document storage | IMPLEMENTED_UNVERIFIED | Basic exists |
| Permission requests | IMPLEMENTED_UNVERIFIED | Migration exists |

---

## Cross-References

- **Trust Model:** `docs/security/FINANCIAL_WRITE_TRUST_MODEL_AR.md`
- **Security Audit:** `docs/audits/SECURITY_DEFINER_COMPANY_ISOLATION_AUDIT_AR.md`
- **Multi-tenant Audit:** `docs/audits/P0_MULTI_TENANT_VERIFICATION_20260723.md`
- **Traceability:** `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
- **Execution Plan:** `governance/10-stage-master-plan.json`
