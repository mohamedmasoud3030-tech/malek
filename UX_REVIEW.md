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
| UX-04 | Functional defect — Critical | Live Supabase inspection: active membership role matches account role, including two `ADMIN` accounts. The custom token hook writes `user_role` into the JWT, while the client authorizes from `session.user.app_metadata`; Supabase documents that a token hook does not change that user object. Screenshots show the resulting false “permissions incomplete” state. | Authenticated capability states, especially Portfolio/Services/Finance | A correctly configured administrator is presented as unconfigured and blocked from expected work areas. | Resolve UI authorization from the server-issued access-token claim, retaining fail-closed behavior for malformed/unknown claims. | IMPLEMENTED BUT NOT VERIFIED — focused Vitest, production build, and authenticated mobile admin journey must pass. |
| UX-05 | Content / hierarchy — Medium | Global permission warning repeats above each visited workspace, while route-level access cards repeat the same failure. | Mobile protected routes | Repetition consumes working space and obscures the actual page context. | NOT STARTED — consolidate only after UX-01–UX-04 are verified, retaining an accessible account-status entry point. |

## Evidence boundaries

- Screenshots establish real mobile RTL behavior for Today, Leasing, Portfolio, Services, and permission/company-resolution states.
- The cloud-browser preview does not share the owner's authenticated app session; it was used only for public login/recovery inspection.
- Live read-only inspection verified role parity across active memberships and account roles; no role, permission grant, company membership, RLS policy, or production data was altered.
- The client correction uses the same server-issued access-token claim that PostgreSQL validates; it does not derive authority from editable user metadata or membership labels.
