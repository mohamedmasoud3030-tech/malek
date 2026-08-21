# MALEK Project Status

Updated: 2026-08-21  
Observed repository: `mohamedmasoud3030-tech/malek`  
Observed default branch: `main`  
Observed main SHA: `b1bb5a901b7adff1aa36b0483195465fe99deeca`

## Executive status

**Repository control:** VERIFIED COMPLETE  
**Current build/test baseline:** BLOCKED  
**Security baseline at current SHA:** NOT VERIFIED  
**Runtime journey baseline:** NOT VERIFIED  
**Governed stage credit:** unchanged; see `governance/10-stage-master-plan.json`  
**Production readiness:** NOT VERIFIED

The project has a substantial implementation and verification history, but the current session did not have a runnable local checkout. Historical evidence is not promoted to current evidence.

## What was actually inspected

### Repository and governance

- `README.md`
- `AGENTS.md`
- `DATABASE_RULES.md` is required by the agent contract
- Canonical Pack index and Documents 6–8
- `governance/10-stage-master-plan.json`
- current open PRs and branch inventory
- root and app package manifests from the repository tree

### Current Git/GitHub state

- Default branch: `main`
- Current main SHA observed: `b1bb5a901b7adff1aa36b0483195465fe99deeca`
- Open draft PRs observed: PR #1531, PR #1532, PR #1533, and PR #1534.
- PR #1531: frontend-only design-system foundation; PR #1533: PWA safety remediation; PR #1534: offline shared-device logout hardening. All require executable verification.
- No branch was reset, cleaned, force-updated, or overwritten.

### Application shape

- Active app: `rentrix-app/`
- Stack observed in manifests: React/Vite/TypeScript, TanStack Router, TanStack Query, Supabase client, Tailwind v4, Radix primitives, Vitest, Playwright, PWA plugin.
- Product: Arabic-first RTL rental/property operations application.
- Canonical visible roots: Today, Portfolio, Leasing, Money, Services, Reports, Settings.
- Financial writes are governed by server/RPC trust boundaries; browser direct sensitive writes are guarded by repository scripts/tests.

## Verification ledger

| Area | Status | Evidence / limitation |
| --- | --- | --- |
| Repository instructions | VERIFIED COMPLETE | `AGENTS.md`, README, Canonical Pack authority rules read |
| Current main ref | VERIFIED COMPLETE | GitHub reports `main@b1bb5a9...` |
| Working-tree cleanliness | NOT VERIFIED | No local checkout was mounted in the session; remote branch/PR state was inspected instead |
| Credential exposure scan | IMPLEMENTED BUT NOT VERIFIED | Static search found privileged-key markers only in QA examples, server/Edge Functions, guards, and tests; no marker was found in browser runtime files inspected. Existing scan not executed. |
| Sensitive financial write boundary | IMPLEMENTED BUT NOT VERIFIED | Static search found no production `.from('journal_entries').insert` result; existing regression guard not executed. |
| Migration hygiene / DB0 gate | NOT STARTED | Historical evidence exists, current execution absent |
| Typecheck | NOT VERIFIED | No current command result |
| Lint | NOT VERIFIED | No current command result |
| Production build | BLOCKED | No local runner; current Vercel status reports external `build-rate-limit` |
| Application tests | NOT VERIFIED | No current command result |
| Browser/e2e journeys | NOT VERIFIED | No running QA/preview journey opened in this session |
| Supabase/Auth/RLS live verification | BLOCKED_EXTERNAL | Requires authorized QA/demo credentials and target |
| Design-system foundation | IMPLEMENTED BUT NOT VERIFIED | PR #1531 contains the change; rendered runtime verification remains |
| PWA safety remediation | IMPLEMENTED BUT NOT VERIFIED | PR #1533 removes unsafe navigation/API caching and adds a controlled update prompt; build artifacts and device checks are not run |
| Offline logout safety | IMPLEMENTED BUT NOT VERIFIED | PR #1534 clears local session/UI authority if remote sign-out fails and adds focused service tests; tests/browser journey are not run |
| Governed stage credit | VERIFIED AS REPORTED | Master plan remains the authority; no credit was changed |

## M1 source-audit observations

- `rentrix-app/src/lib/supabase.ts` constructs the browser client solely from `env.supabaseAnonKey`; `env.ts` reads only public `VITE_SUPABASE_*` values.
- The privileged-key scan covers browser source/public/index files and explicitly rejects service-role/private-key/OpenAI markers.
- Search at the observed main SHA located `SUPABASE_SERVICE_ROLE_KEY` only in QA templates, server/Edge Function code, isolated local/QA smoke scripts, tests, and guard scripts. This is source evidence, not execution proof.
- `supabase/functions/background-worker/index.ts` requires a separate `BACKGROUND_WORKER_SECRET` before using its server-side service role key.
- QA mutation scripts refuse production targets before client creation; the intentional lifecycle additionally requires an explicit QA approval flag.

## M5 auth/logout milestone

- **Outcome:** an explicit logout must remove a previous operator from a shared browser even when remote Auth is unreachable.
- **Reproduced by source:** the former `logout()` awaited remote sign-out before clearing in-memory session; a rejected request could retain protected UI.
- **Implemented:** PR #1534 first attempts remote sign-out, then local-only sign-out; local storage is removed in either case. `AuthProvider` now clears permissions/session and navigates to `/login` in `finally`.
- **Focused coverage added:** remote success, remote failure with local fallback, and fallback failure in `auth-service.test.ts`.
- **Status:** IMPLEMENTED BUT NOT VERIFIED. No test/build/browser run is claimed.

## External blockers

1. Vercel status for current observed main/PR head reports `build-rate-limit`; this is an external account/service limitation, not code evidence.
2. No runnable local checkout was available in this session, so executable checks cannot truthfully be reported as passed.
3. Hosted Supabase/Auth verification requires the authorized QA/demo target; no production mutation is requested or performed.

## Next milestone

M1: execute the existing current-SHA security and boundary guards from a runnable checkout. The first code change will only be made after a reproducible finding is captured.

## UX mobile recovery milestone

- **Rendered evidence:** owner-supplied authenticated mobile screenshots confirmed a full-height permission-request dialog with large unused space, repeated access denial states, and an unbounded active-company loading state.
- **IMPLEMENTED BUT NOT VERIFIED:** PR #1535 scopes the full-height mobile Dialog behavior to `EntityForm` only, adds active-company resolution timeout/recovery copy, restores valid CSS imports, and adds focused regression coverage.
- **VERIFIED DEFECT:** Vercel build log for branch `arena/mobile-recovery-surfaces` found `globals.css:4` invalid because a literal `\\n` joined CSS imports. The repair is on the branch; the current Vercel quota/rate-limit has not produced a build for the repair commit.
- **BLOCKED:** Current account access to Portfolio/Services is a live role/grant configuration issue. No permission was escalated or data was changed.


## Auth role-claim milestone

- **Outcome:** a valid `ADMIN` account must not be marked “permissions incomplete” merely because Supabase’s session user object omits a custom access-token claim.
- **VERIFIED ROOT CAUSE:** live `custom_access_token_hook` reads `public.users.role` and stamps `app_metadata.user_role` into the JWT. The previous client authorization code instead read `session.user.app_metadata`. Supabase documents that token hooks modify the JWT, not that session user object.
- **Live read-only evidence:** all active company membership roles match their account role; this includes two `ADMIN` memberships. The reported screenshots are therefore consistent with a client token-claim consumption defect, not missing Admin configuration.
- **IMPLEMENTED BUT NOT VERIFIED:** PR #1535 now decodes only the server-issued access-token role for client UI authorization, falling back to existing metadata only when the token has no valid role. Unknown or malformed claims deny access. Focused regression tests cover the valid `ADMIN` token claim and malformed/unknown claim rejection.
- **No production mutation:** no user, membership, permission grant, RLS policy, JWT hook, or deployment was changed.

## PWA build dependency milestone

- **VERIFIED DEFECT:** Vercel deployment `dpl_EYf9QgKzpkZasJfbTXvYm8BDJdxt` passed the earlier CSS parse point and then failed because Rollup could not resolve `workbox-window` from Vite PWA's virtual registration module.
- **Root cause:** `workbox-window@7.4.1` existed as a transitive lockfile package but was not a direct `rentrix-app` dependency. pnpm's isolated module layout correctly prevents the virtual module from using an undeclared dependency.
- **IMPLEMENTED BUT NOT VERIFIED:** declared `workbox-window@^7.4.1`, synchronized its existing lockfile resolution, and added `pwa-dependency-contract.test.ts`.
- **Next evidence:** a Vercel preview build of the branch must pass, then its generated manifest/service worker can be inspected. No deployment was promoted and no production configuration was changed.
