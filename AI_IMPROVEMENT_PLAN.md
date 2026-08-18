# MALEK — AI Improvement Plan

> Prioritized autonomous plan. External gates remain owner/credential dependent.  
> Status labels: `VERIFIED COMPLETE` | `IMPLEMENTED BUT NOT VERIFIED` | `BLOCKED BY OWNER/EXTERNAL ACTION` | `NOT STARTED`

## Recommended sequence (why)

1. Install/SEO and login honesty (done).  
2. Supabase detail visibility + soft-delete list honesty (done).  
3. Hot-path indexes in repo + QA apply pack (done; live apply blocked on egress).  
4. **Error≠empty on money workspaces** (this milestone).  
5. Confirmatory freeze guards + selective builds.  
6. External live/pilot track only with owner ops.

---

## Milestone A — PWA icons + robots

**Status:** repository `VERIFIED COMPLETE`; real-device install `IMPLEMENTED BUT NOT VERIFIED`.

## Milestone B — Placeholder env login honesty

**Status:** `VERIFIED COMPLETE` (repository).

## Milestone C — Public shell regression pack

**Status:** largely covered by brand/sitemap contracts; full CI on PR.

## Milestone D — Production build + typecheck

**Status:** `VERIFIED COMPLETE` earlier; typecheck re-run green after Milestone E.

## Milestone E — UX empty/error honesty (high-traffic money)

**Outcome:** Failed bank (and settings payment-terms) reads never look like successful empty data.  
**Acceptance:**

- accounts/lines `isError` → `ErrorState` + retry;
- empty cards only when `!isError`;
- table not shown on lines error;
- KPI grid hidden on read error;
- payment-terms error alert distinct from empty catalog;
- regression contract tests PASS; typecheck PASS.

**Status:** `VERIFIED COMPLETE` (repository).  
**Evidence:** `bank-reconciliation-error-states.test.ts` 4/4; typecheck exit 0.

## Milestone F — Financial/security freeze checks

**Outcome:** sensitive-write, business-rules, GL write boundary still green after recent changes.  
**Status:** `VERIFIED COMPLETE` this session (all three guards OK).

## External track

| Gate | Status |
|---|---|
| QA index SQL apply | `BLOCKED BY OWNER/EXTERNAL ACTION` (egress); pack ready |
| Hosted Auth/RLS/Storage proof | blocked |
| Backup/restore | blocked |
| Browser readiness current SHA | CI/external |
| Pilot / tax / legal / S08 | blocked |

## Not in near plan

Framework rewrites, Master Lease “IFRS complete”, historical correction, WhatsApp send, rentrix path rename.
