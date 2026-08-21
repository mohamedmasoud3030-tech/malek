# MALEK Project Status

Updated: 2026-08-21  
Observed repository: `mohamedmasoud3030-tech/malek`  
Observed default branch: `main`  
Observed main SHA: `b1bb5a901b7adff1aa36b0483195465fe0de9eca`

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
- Current main SHA observed: `b1bb5a901b7adff1aa36b0483195465fe0de9eca`
- Open PRs observed: PR #1531 only
- PR #1531: draft, frontend-only design-system foundation, base `main`, head `arena/design-system-foundation`
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
| Governed stage credit | VERIFIED AS REPORTED | Master plan remains the authority; no credit was changed |

## M1 source-audit observations

- `rentrix-app/src/lib/supabase.ts` constructs the browser client solely from `env.supabaseAnonKey`; `env.ts` reads only public `VITE_SUPABASE_*` values.
- The privileged-key scan covers browser source/public/index files and explicitly rejects service-role/private-key/OpenAI markers.
- Search at the observed main SHA located `SUPABASE_SERVICE_ROLE_KEY` only in QA templates, server/Edge Function code, isolated local/QA smoke scripts, tests, and guard scripts. This is source evidence, not execution proof.
- `supabase/functions/background-worker/index.ts` requires a separate `BACKGROUND_WORKER_SECRET` before using its server-side service role key.
- QA mutation scripts refuse production targets before client creation; the intentional lifecycle additionally requires an explicit QA approval flag.

## External blockers

1. Vercel status for current observed main/PR head reports `build-rate-limit`; this is an external account/service limitation, not code evidence.
2. No runnable local checkout was available in this session, so executable checks cannot truthfully be reported as passed.
3. Hosted Supabase/Auth verification requires the authorized QA/demo target; no production mutation is requested or performed.

## Next milestone

M1: execute the existing current-SHA security and boundary guards from a runnable checkout. The first code change will only be made after a reproducible finding is captured.
