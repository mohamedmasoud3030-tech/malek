# Cross-application reconstruction coverage

Date: 2026-09-09. Baseline: `fe2a5911076229206eb54cbcd7f3fc5303501360`.

This records reconstruction, not a new product specification or release approval.
The original source-of-truth rules, financial model and completion gates remain authoritative.

## Final application shape

- **Route contract → router/layout:** one workspace permission mapping, with action/section permissions still enforced independently and backend authorization unchanged.
- **Session storage → auth service → provider/route guards:** one persisted key and cleanup policy; one fail-closed restore boundary. Offline logout does not falsely promise server token revocation.
- **Feature UI → hooks/selectors → scoped services → Supabase/RPC:** UI retains the same product surfaces. Shared data-reading mechanisms live in `lib/paginatedRead.ts`, not competing feature loops. A safety-cap failure is not represented as a complete financial result.
- **Invoice read calculations:** `financials/invoices/invoice-amounts.ts` owns gross and collectible remaining amounts. Database posting, general ledger statements, credit/reversal lifecycles and rounding/storage constraints remain server-owned.
- **Party contract context:** `contracts/services/contractService.ts:listContractsForTenants` owns scoped contract reads shared by person and tenant dossiers and the tenant register.
- **Report cache:** one arrears snapshot with selectors; one financial-period snapshot also projected into collection summary. Different property/tenant/date scopes retain separate keys. Root invalidation refreshes the shared source.
- **Tabular output:** `lib/csvExport.ts` owns RFC escaping and formula neutralization; ordered feature exports and office templates reuse it. PDF/document generation is a distinct preserved capability, not another CSV implementation.
- **Office import:** one specification/parser/preview/template module; no compatibility overlay with contradictory unit fields. Upload remains preview-only and never bypasses governed writes.
- **Public configuration:** one pure resolver used by runtime and Vite; no SDK dependency in that policy.

## Classification and depth

| Capability | Classification | Evidence and preserved boundaries |
|---|---|---|
| Session, navigation, route workspace authorization | CONSOLIDATE — implemented | Provider/service/router traced; returned/thrown logout errors, storage failures, membership/grant and route matching tests; hermetic login/RTL browser matrix. RLS is not replaced by UI gates. |
| Invoice amounts and collection | REBUILD read model / KEEP writes | List → preview/quick collection → service projections → invoice schema/payment RPC traced. Net + VAT − payments − credits agrees with replayed credit/reversal state. Desktop/mobile actual-route collection presets tested without submitting payment. |
| Contract, person, tenant, property and owner financial context | CONSOLIDATE — implemented | Hook batching removed; full scoped contract/invoice/payment/receipt reads and shared arithmetic. Query-aware >1000-row, multi-batch, deleted/foreign-record, failure and permission-gating regressions. Real receipt references retained. |
| Operational arrears/period/collection reports | CONSOLIDATE — implemented | UI-mounted hooks, cache keys, loaders, projections, invalidation and scope separation traced. Real QueryClient tests prove one read per snapshot. Real calendar dates and recognized status inputs enforced at URL/state boundaries. |
| CSV feature exports and office imports | REBUILD encoder / CONSOLIDATE specifications | RFC quote/newline/formula cases, localized headers, typed negative numbers, five-entity CSV/XLSX template parity, impossible dates, source row indexing and stale parse/entity-switch results tested. No database writes introduced. |
| Integrity audit and deposit invoice choices | CONSOLIDATE / corrective rebuild | Integrity overpayment checks use VAT-inclusive gross; its 5000-row unavailable-state contract is retained. Deposit invoice options include VAT/credits, soft-delete scope and complete reads. Deposit mutation authority remains RPC-owned. |
| Build/runtime configuration and dependencies | CONSOLIDATE / REMOVE verified unused | Runtime/build policy parity, configured/unconfigured states and custom/local URLs tested. Recognizable non-public keys are rejected by runtime policy and Vite even for local builds; no key prefixes are logged. Unused motion/telemetry dependencies removed only after import/reference inspection. Runtime Sonner retained. |
| Accounting, banking, reconciliations, commissions, owner agreements/settlements | KEEP | These are different accounting capabilities, not duplicates of operational finance. Local migration-backed financial, lifecycle and permission tests retained and rerun. No SQL or historical posting rewrite. |
| Properties, units, land, onboarding, leasing lifecycle | KEEP; shared reads updated where used | Existing relationship/activation/evidence authorities retained. Local behavioral and migration-replay tests guard them; contract keyboard/register and owner responsive browser checks supplement unit tests. |
| Maintenance, utilities, providers, automation | KEEP | Existing service/RPC boundaries, workflow tests and browser surfaces retained. Automation's preview-only WhatsApp behavior and guarded deposit creation are tested, not converted into invented integrations. |
| Documents, vault, portals, communication, AI, audit/support | KEEP | Contextual document authority and signed/scoped access model retained. Report A4/RTL, genuine PDF and share-fallback browser journey exercised. Portal/isolation/AI tests are local evidence, not hosted integrations. |
| Shared responsive UI, RTL and PWA | KEEP; validate rather than novelty redesign | Existing register/dialog/form primitives retained; accessibility primitives and desktop/tablet/mobile/light/dark checks rerun. Production browser verification confirms worker activation, Arabic RTL offline navigation fallback, and no observed API/auth/storage response caching. Real-device installation/update recovery remains unverified. |
| SQL history, brand aliases and five support-only graph files | KEEP / UNKNOWN for removal | Migration history, public URLs and test/script references make byte/path duplication insufficient deletion evidence. No speculative removal. |

## What was removed, rather than left in parallel

- Route-layout workspace permission map and competing session cleanup/restore code.
- Dossier hook-owned batching and feature-specific report/integrity pagination loops.
- Separate arrears-summary/aging service requests and separately cached collection-summary reads.
- Repeated invoice remaining arithmetic and omitted VAT/credit read projections.
- Tenant/person contract query copies.
- Parallel office-import compatibility specification/CSV encoder.
- JSON-style CSV escaping and ad hoc feature export encoders.
- Duplicate build/runtime configuration checks; unused `framer-motion`, `@vercel/speed-insights`, and duplicate development declaration of runtime `sonner`.

## Completion limits — do not infer a release certificate

1. **Hosted verification is blocked:** deployed Auth/RLS/schema drift, Storage/Edge settings and real persisted end-to-end operations require an authorized QA environment. No production writes or GitHub pushes were performed.
2. **Preservation is not blanket correctness:** the full local suite exercises many existing modules, but does not prove every branch or certify every module was rebuilt. KEEP is a deliberate classification; similar folder names do not justify merging distinct business capabilities.
3. **Existing partial product capabilities remain explicit:** office import is preview-only; document share uses truthful browser fallbacks; reconciliation/other governed stage gaps keep their existing completion credit. Reconstruction did not invent unsafe write paths to make them appear complete.
4. **Read scale is bounded and fail-closed:** browser reads use documented safety ceilings and deterministic pagination. Server aggregation for larger datasets and stable snapshots during concurrent writes require separately governed backend work.
5. **PWA/visual evidence is local:** production service-worker generation and browser viewport checks are not real-device install/update/offline or external accessibility certification.

Current commands/results are recorded in `RECONSTRUCTION_INVENTORY.md` and the deliverable validation logs. Earlier first-extraction totals in source-of-truth document 07 remain historical, not current-tree evidence.
