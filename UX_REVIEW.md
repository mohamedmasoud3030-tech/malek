# MALEK UX Review — Mobile Access and Recovery

Updated: 2026-08-21  
Evidence basis: authenticated mobile screenshots supplied by the owner, rendered public login/recovery preview, current source, and Vercel build logs.  
Scope: this is a factual first milestone, not a claim that every authenticated route is fully reviewed.

## Findings

| ID | Type / severity | Observed evidence | Affected route/state | User impact | Selected correction | Status / acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- |
| UX-01 | Functional defect — Critical | Vercel build log: PostCSS rejects `globals.css:4` because a literal `\\n` joins two `@import` rules. | Production build | New commits cannot be deployed or rendered. | Restore two real CSS import lines and add a regression test. | IMPLEMENTED BUT NOT VERIFIED — latest branch build must pass. |
| UX-02 | Usability and visual defect — High | Mobile permission-request screen contains a short reason field but expands to a full visual viewport, leaving most of the screen empty and separating request context from its action. | Permission-request dialog, mobile RTL | Approval request appears broken and makes a simple task feel long and uncertain. | Limit full-height mobile dialogs to explicit `EntityForm` workflows; keep short permission dialogs compact. | IMPLEMENTED BUT NOT VERIFIED — 320/375/390 px visual checks and focused Playwright test must pass. |
| UX-03 | Missing recovery state — High | Screenshot shows `جارٍ تحديد الشركة النشطة…` with no visible completion or escape path; subsequent screenshot shows generic failure after retry. | Active-company resolution | Operator is blocked from the whole product with no bounded wait or clear next step. | Apply a 12-second fail-closed timeout and explain retry plus the membership-administrator dependency. | IMPLEMENTED BUT NOT VERIFIED — focused Vitest timeout case and authenticated mobile retry journey must pass. |
| UX-04 | Functional configuration blocker — High | Same account can view Today and Leasing but receives `غير مصرح بالوصول` for Portfolio and Services; persistent notice says permissions are incomplete. | Current account, Portfolio/Services/Finance capability states | The user cannot access expected work areas. | Do not silently elevate access. The visible request-access flow remains the correct UI. Authorized administrator must verify the account's `company_members` role and effective grants. | BLOCKED — requires an explicit authorized database/account administration action. |
| UX-05 | Content / hierarchy — Medium | Global permission warning repeats above each visited workspace, while route-level access cards repeat the same failure. | Mobile protected routes | Repetition consumes working space and obscures the actual page context. | NOT STARTED — consolidate only after UX-01–UX-04 are verified, retaining an accessible account-status entry point. |

## Evidence boundaries

- Screenshots establish real mobile RTL behavior for Today, Leasing, Portfolio, Services, and permission/company-resolution states.
- The cloud-browser preview does not share the owner's authenticated app session; it was used only for public login/recovery inspection.
- No role, permission grant, company membership, RLS policy, or production data was altered by this milestone.
