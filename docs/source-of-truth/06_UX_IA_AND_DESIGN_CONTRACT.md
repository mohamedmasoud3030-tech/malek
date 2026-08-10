# MALEK Canonical Pack — Document 6: UX, IA, and Design Contract

> **Status:** CANONICAL  
> **Rule ID Prefix:** UX-###  
> **Effective Date:** 2026-08-10

---

## 1. Navigation Hierarchy

### 1.1 Top-Level Structure

**UX-101 — Primary Navigation**

The main navigation is organized into domain hubs:

| Hub | Route | Description |
|-----|-------|-------------|
| Dashboard | `/` | Home with KPIs and urgent actions |
| Properties | `/properties` | Property and unit management |
| People | `/people` | Owners, tenants, contacts |
| Contracts | `/contracts` | Lease contract lifecycle |
| Financials | `/financials` | Financial operations hub |
| Reports | `/reports` | Analytics and formal reports |
| AI Assistant | `/ai-assistant` | AI-powered assistance |
| Settings | `/settings` | System configuration |

**UX-102 — Financial Hub Sections**

Within `/financials`, sections are:

| Section | Default View | Description |
|---------|--------------|-------------|
| Overview | — | Financial summary KPIs |
| Collections | Invoices | Invoices, receipts, arrears |
| Expenses | Expenses | Operational costs |
| Funds | Deposits | Deposits and owner settlements |
| Banking | Reconciliation | Bank matching |

**UX-103 — Reports Categories**

Reports are grouped into 3 macro categories:

| Category | Sections |
|----------|----------|
| LIVE OPERATIONAL INSIGHTS | Overview, Collections, Overdue, Occupancy, Maintenance |
| ANALYTICAL VIEWS | Occupancy trends, Maintenance, Deferred Revenue |
| FORMAL REPORTS | Trial Balance, Income Statement, Balance Sheet, GL, Statements |

---

## 2. Route Structure

### 2.1 Protected Routes

**UX-201 — Route Tree**

```
_protected/
├── index                    # Dashboard
├── properties
│   ├── $propertyId
│   │   ├── index            # Property detail
│   │   ├── edit             # Property edit modal
│   │   └── units
│   │       ├── $unitId      # Unit detail
│   │       └── index        # Units list
│   ├── new                  # Property create
│   └── index                # Properties list
├── people
│   ├── $personId
│   │   ├── index            # Person dossier
│   │   └── edit             # Person edit modal
│   ├── new                  # Person create
│   └── index                # People list
├── contracts
│   ├── $contractId
│   │   ├── index            # Contract detail
│   │   └── edit             # Contract edit modal
│   ├── new                  # Contract create
│   └── index                # Contracts list
├── financials               # Financial hub
├── reports                  # Reports workspace
├── ai-assistant             # AI Assistant
├── settings                 # Settings workspace
├── commissions              # Commissions (standalone)
├── service-providers        # Service providers
├── maintenance              # Maintenance requests
├── audit-log                # Audit trail
└── change-password          # Password change
```

**UX-202 — Redirects**

| From | To | Purpose |
|------|-----|---------|
| `/accounting` | `/reports?section=general_ledger` | GL canonical path |
| Legacy deep-links | Standalone routes | Phase cleanup |

---

## 3. Page Patterns

### 3.1 Entity Workspaces

**UX-301 — Detail Page Pattern**

Each entity (property, person, contract) follows:

1. **Detail Header** — Entity name, status badges, primary actions
2. **Section Tabs** — Contextual tabs (`?section=`) with deep-link support
3. **Content Area** — Tab-specific content
4. **Action Footer** — Bulk actions when applicable

**UX-302 — Create/Edit Pattern**

Modal-based creation and editing:
- Centered modal over workspace context
- Single-pass validation
- Dirty state protection
- Success confirmation with action

**UX-303 — List Pages**

- Paginated table with column sorting
- Filter pills for common filters
- Bulk selection for batch actions
- Empty state with action prompt

---

## 4. Responsive Design

### 4.1 Viewport Matrix

**UX-401 — Minimum Viewports**

| Width | Requirement |
|-------|-------------|
| 320px | Usable without horizontal scrolling |
| 375px | Primary small-phone acceptance |
| 414px | Large-phone acceptance |
| 768px | Tablet portrait acceptance |
| 1024px | Desktop threshold |
| 1440px | Desktop verification width |

**UX-402 — Mobile Patterns**

- Single-column page flow (320-414px)
- Two-column summary composition (768px+)
- Progressive disclosure for secondary content
- Bottom sheets for filters and compact forms
- Sticky headers for context
- Safe-area handling for PWA

**UX-403 — Desktop Patterns**

- 12-column modular grid
- Sidebar navigation
- Dense tables for financial data
- Bento layouts for dashboard summaries

---

## 5. RTL and Localization

### 5.1 RTL Behavior

**UX-501 — Direction Requirements**

- Default direction: **RTL**
- Logical properties (`start`/`end`) required for all spacing, borders, alignment
- Icon placement follows RTL conventions
- Numeric fragments may use `dir="ltr"` for stability

**UX-502 — Arabic-First**

- Arabic is primary reading mode
- English and numeric fragments must not break RTL experience
- All user-facing text in Arabic (English fallback for technical content)

**UX-503 — Latin Numerals**

- Financial values display with Latin numerals (`-u-nu-latn`)
- Tabular numerals for alignment in tables
- Currency tag: `ر.ع.` (Omani Rial)

---

## 6. State Handling

### 6.1 Loading States

**UX-601 — Loading Patterns**

- Skeleton screens for content waits
- Spinner for action processing
- Progress indicators for multi-step operations
- Async content component for general use

**UX-602 — Empty States**

- Contextual empty state with action prompt
- Clear explanation of what's missing
- Primary action button to create item

**UX-603 — Error States**

- Error boundary for component failures
- User-friendly error messages in Arabic
- Retry action where applicable
- Support contact for persistent errors

**UX-604 — Permission Denied**

- Access denied component for unauthorized routes
- Clear indication of missing permission
- Contact admin suggestion

---

## 7. Forms and Validation

### 7.1 Form Patterns

**UX-701 — Enterprise Forms**

- Sensible width (not full-width)
- Grouped fields with clear labels
- Responsive grid layout
- Progressive disclosure for advanced options
- Single-pass validation (no cascading errors)
- Dirty state protection before navigation

**UX-702 — Validation Rules**

- ISO date format (YYYY-MM-DD)
- Positive finite numbers for amounts
- Required field indicators
- Inline error messages
- Form-level error summary

---

## 8. Tables and Data Display

### 8.1 Dense Registers

**UX-801 — Table Pattern**

Mobile-optimized tables:
- One compact responsive table
- Column priority (most important visible)
- Progressive disclosure for details
- Sticky identity and actions columns
- Controlled horizontal scrolling

**UX-802 — Financial Tables**

- Tabular numerals for alignment
- Consistent decimal places (3dp)
- Positive/negative indicators
- Status badges with semantic colors

---

## 9. Visual Design

### 9.1 Color System

**UX-901 — Semantic Colors**

| Role | Light | Dark | Usage |
|------|-------|------|-------|
| Primary (MALEK blue) | `#...` | `#...` | Brand primary, actions |
| Background | `#FAFAFA` | `#...` | Page canvas |
| Card | `#FFFFFF` | `#...` | Elevated surfaces |
| Text Primary | `#...` | `#...` | Main content |
| Text Secondary | `#...` | `#...` | Supporting text |
| Success | `#22C55E` | `#...` | Posted, positive |
| Warning | `#F59E0B` | `#...` | Partial, aging |
| Danger | `#EF4444` | `#...` | Destructive, overdue |
| Info | `#3B82F6` | `#...` | Draft, informational |
| Neutral | `#6B7280` | `#...` | Archived, void |

**UX-902 — Accessibility**

- WCAG AA minimum (4.5:1 normal, 3:1 large text)
- Color never the only status indicator
- Focus rings visible in both themes

### 9.2 Typography

**UX-911 — Font Stack**

- **Arabic:** Cairo (self-hosted)
- **Latin:** Sora (headings)
- System fallbacks

**UX-912 — Scale**

| Element | Size | Weight |
|---------|------|--------|
| Title | 28-32px | 700 |
| Page Heading | 24-28px | 700 |
| Section Heading | 18-20px | 600 |
| Body | 16-18px | 400-500 |
| Label | 14px | 500-600 |
| Caption | 12-13px | 400-500 |
| Financial Number | 14-16px (tables) | 600-700 |

### 9.3 Shape and Depth

**UX-921 — Radius**

| Element | Radius |
|---------|--------|
| Card | ~14px |
| Input | ~12px |
| Button | ~12px |
| Sheet/Dialog | ~16px |
| Pill/Badge | Full radius |

**UX-922 — Shadows**

- Soft neutral shadows for elevation
- Card shadows suggest separation, not spectacle
- No decorative blur-heavy glass effects

---

## 10. Documents and Printing

### 10.1 Document Generation

**UX-1001 — PDF Standards**

- Clean RTL output
- MALEK branding (no Rentrix legacy icons)
- Latin numerals for alignment
- 3 decimal places for money
- Currency tag `ر.ع.`

**UX-1002 — Print Styles**

- Receipts, invoices, settlement statements printable
- Clean layout without UI chrome
- Consistent branding

---

## 11. Interaction Safety

### 11.1 Destructive Actions

**UX-1101 — Confirmation Requirements**

- Delete/archive: Confirmation dialog required
- Void/reverse: Reason input required
- Settlement payment: Final confirmation required

**UX-1102 — Swipe Restrictions**

Swipe must **never** directly:
- Commit payment
- Post financial entry
- Delete records
- Approve settlement
- Any irreversible financial operation

---

## 12. Component Inventory

### 12.1 Shared Components

**UX-1201 — Core Primitives**

| Component | Location |
|-----------|----------|
| Button | `components/ui/button` |
| Input | `components/ui/input` |
| Card | `components/ui/card` |
| Table | `components/ui/table` |
| Modal | `components/ui/modal` |
| Dialog | `components/ui/dialog` |
| Form | `components/ui/form` |
| Badge | `components/ui/badge` |
| EmptyState | `components/empty-state` |
| LoadingState | `components/loading-state` |
| ErrorBoundary | `components/error-boundary` |
| AsyncContentState | `components/async-content-state` |
| PageStateCard | `components/page-state-card` |
| SectionTabs | `components/ui/section-tabs` |

---

## 13. Implementation Status Summary

### 13.1 Verified Complete

| Feature | Evidence |
|---------|----------|
| Enterprise UX foundation | `components/enterprise/*` |
| Hub consolidation | Hub navigation contract test |
| Modal-based create/edit | Feature tests |
| Compact tables | `CompactResponsiveTable` |
| Section tabs with deep links | Section model tests |
| Reports consolidation | `reports-groups.test.ts` |
| Loading/error/empty states | Component coverage |
| RTL support | Visual contract tests |
| Financial formatting | `formatters.ts` |

### 13.2 Partial Implementation

| Feature | Gap |
|---------|-----|
| Maker-Checker UI | Backend pending |
| FGR-006 approval | Backend pending |
| Service providers | Browser verification blocked |
| Document generation | Legal templates pending |

---

## Cross-References

- **Visual Contract V2:** `docs/ui-ux/MALEK_VISUAL_CONTRACT_V2.md`
- **Visual Audit:** `docs/ui-ux-audit-2026-08-09.md`
- **IA Cleanup:** `docs/ui-ux/IA_NAVIGATION_CLEANUP_20260807.md`
- **Traceability:** `07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md`
- **Component Tests:** `rentrix-app/src/features/*/`
