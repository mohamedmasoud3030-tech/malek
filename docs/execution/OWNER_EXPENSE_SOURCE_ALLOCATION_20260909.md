# Owner expense allocation and lawful settlement source — 2026-09-09

Status: implemented repository milestone; financial reconstruction and final application audit remain IN PROGRESS. Continues verified `3bfa38322491de4f885f0e47fce33fa66b6e1a6c` on `reconstruction/checkpoint-20260909`. No production data was changed.

## Authority and lineage

Migration `20260909000012_owner_expense_allocation_source.sql` extends existing authorities:

1. The public expense command validates explicit owner allocations and approval-reference evidence, company/property/effective owner membership, exact three-decimal total, distinct owners and optional agreement scope. Each allocation creates one canonical owner receivable through1300 and its cash posting. A label alone creates neither ownership allocation nor offset rights. Responsibility is normalized and unknown classifications rejected.
2. Immutable expense→allocation→receivable links preserve the evidence and exact agreement version. Deferred completeness constraints prevent incomplete adopted sources from committing. The receivable writer rejects duplicate claims against an already allocated source. Original receivable identity and posting links cannot be edited or deleted.
3. Existing settlement, owner statement, owner balance and1300 selectors exclude adopted expenses from the legacy expense calculation before aggregation/reservation. Native obligations remain receivables, not automatic deductions from owner funds.
4. Unadopted legacy expenses remain historically visible. New draft/approval/payment effects involving their automatic deduction fail with `OWNER_SETTLEMENT_LEGACY_EXPENSE_REVIEW_REQUIRED`. Cached operations retain their original verified responses. This is a safety stop, NOT a completed historical adoption/remediation workflow; an S08 review alone does not lift it.
5. Existing explicit lawful-offset and cash-recovery commands clear allocated receivables. The settlement payout source event now captures only actual residual cash, verified against its2000 posting. A fully offset settlement creates neither a fictitious cash journal nor a second payout event. Previously recorded payout events are not rewritten.
6. S08 snapshots include adopted allocation/evidence and the receivable/recovery/offset posting graph. Legacy snapshot shape stays unchanged. Generic S09 correction of adopted sources is refused in favor of the owner-receivable adjustment authority; user-facing governed adjustment integration remains open.
7. Positive OWNER maintenance closure uses the same allocation command. Cost storage is widened to18,3 without inventing missing historical decimals. Scoped intent-aware closure cache protects retries. The client verifies acknowledgement identity, closed status, exact cost/responsibility and expense linkage; uncertain outcomes invalidate source and all financial read models. The obsolete maintenance resolver can only perform permission-checked zero-cost technical completion; it can no longer insert an unposted expense.
8. Shared expense/maintenance allocation UI captures owner, amount, optional agreement and evidence reference. Adopted expense edits are metadata-only. Maintenance wording now describes a receivable, not an automatic deduction.

## Persisted and browser evidence

Logs are under `/home/user/validation/owner-expense/` (workspace evidence, not hosted execution).

- Source SQL:16 tests PASS, including actual deferred constraint firing, immutable scope, duplicate claims, company boundaries, native creation/maintenance, valid retries, upgrade preservation and legacy write-path rejection.
- Coupled source:30.125 expense, recovery10, lawful offset20.125. Owner funds1000 are not initially reduced by the expense. Checker pays979.875 once. Final1300 source/control200/200 retains the old obligation;2000 source/control0/0. With recovery economically on day10, an earlier day9 query after later operations returns1300 source/control210/210, not the current outstanding200.
- Full offset:1000 is cleared by authorized offset, with no additional payout event/cash posting.
- Upgrade: unchanged historical expense/batches and cached identities survive. An unchanged pre12 S08 server snapshot can be approved independently after12. A pre12 approved settlement replays its approval but cannot newly pay an unreviewed legacy deduction. A new draft is likewise refused, with status and batches unchanged.
- Historical diagnostic/source-control fixtures create authentic pre12 records, THEN apply12 before the main assertions. They are not merely pinned to old implementations to obtain green tests. Current-authority source/history suites:44 PASS (`current-authority-history.log`). The separate named10→11 upgrade scenario retains its deliberate historical boundary.
- Latest-chain P2/R2/R8 lifecycle fixtures use explicit allocation and valid owner/period prerequisites. P2:450 rent−45 fee gives405 payable, OWNER30 stays on1300, COMPANY20 alone goes to6100, cash400. Both canonical source journals balance; no legacy-journal facade is required for native receivables.
- Built-app desktop/mobile browser:2 PASS,34.5s (`browser-maintenance-final.log`). Both cover actual SQL expense creation, retained allocation after lost acknowledgement, same-intent retry, real SQL lawful recovery/offset/payout, six financial report checks, then actual SQL maintenance closure42.125 with a deliberately mismatched first acknowledgement, retained form and duplicate-free retry. Maintenance has no inferred offset right; reports reconcile after closure.
- Browser auth and ancillary entity/catalog reads use the acceptance harness. These are expense/maintenance command UI and report UI proofs, NOT hosted JWT/PostgREST/RLS/concurrency verification or recovery/offset command UI proof. Initial browser attempts exposed missing ancillary catalog fixtures and an incorrect mobile overflow-menu locator; corrected without weakening assertions or enabling retries. One initial zero-duration desktop failure was not diagnosed.
- Final full suite after strengthening:540 files /3,833 tests PASS,561.69s (`full-checkpoint-final.log`). Main/test TypeScript PASS (`types-checkpoint-final.log`, `test-types-checkpoint-final.log`); six repository gates and frontend/database contracts PASS (`gates.log`, `contracts-final.log`). The contract scanner rejected a dynamic maintenance RPC spread; explicit typed argument fields removed that ambiguity without an allowlist exception.
- Final production E2E/PWA build PASS (`build-checkpoint-success.log`). Earlier attempts exhausted sandbox memory (exit137 and a768MB heap limit); limiting build-worker concurrency and allocation arenas succeeded without changing application build configuration.
- Refreshed browser run: mobile PASS, desktop stopped at the existing workspace-initialization screen before final report readiness (`browser-checkpoint-final.log`); unchanged desktop/mobile rerun2 PASS,37.3s (`browser-checkpoint-rerun.log`). This intermittent initialization risk remains unresolved, not hidden by retries or longer assertions.

## Deployment / preservation

Forward-only transactional migration with checked function-definition patch preconditions and schema reload notification. No history backfill, destructive rename, new parallel command tree or direct ledger mutation. Explicitly named internal compatibility implementations still serve non-OWNER behavior and old caches; fresh OWNER writes through the old private writer are rejected. Allocation SELECT requires financial-report permission and company scope; public mutation grants are absent. Type contracts were aligned locally, not regenerated against a hosted database.

Do not deploy this as an automatic historical cleanup. Existing unpaid legacy-netted settlements can require a governed resolution before payment; assess real source evidence and communicate this safety stop. Existing historical rounded costs and gross payout-source discrepancies require separate authorized review, not guessed reconstruction.

## Open inventory — do not claim financial/application completion

IN PROGRESS / NEXT:
- Governed historical expense adoption/remediation, including already approved legacy-netted settlements and old gross payout events; no production source/legal evidence is available.
- Full pre12-approved S09 draft/apply compatibility across12 beyond the existing pending-review/posted-history proofs.
- Owner-receivable adjustment/recovery/offset management UI, and complete adjusted/reversed parent-expense presentation; backend command tests are not UI completion.
- Owner agreement selector pagination and wider source-data access boundaries.
- Remaining owner statement/cache/rebuild/classification paths and historical reporting audit. Do not repair displays to conceal a source/control discrepancy.
- Complete financial inventory first, then the requested application-wide audit: business rules, historical integrity, permissions/auth/isolation/RLS, reports, data access, responsive RTL/accessibility, PWA/offline, migrations, security, references/dead code/dependencies and regression coverage.

BLOCKED externally: hosted configuration/credentials, hosted JWT/PostgREST and multi-session concurrency verification, actual production source evidence and authorized remediation. Missing hosted configuration does not block the repository tasks above.

PRESERVED: meaningful non-OWNER expense behavior, original posted history, company and permission boundaries, exact-money semantics and retry identity.

REMOVED/RETIRED: alternate positive-cost raw maintenance expense insertion; fresh OWNER creation through the private company-expense implementation; automatic new settlement deduction of unreviewed legacy expense labels.
