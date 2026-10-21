# 0021 — Restored browser sessions are verified against Auth before the shell opens

- **Status:** Accepted
- **Date:** 2026-10-21
- **Supersedes:** PR #1832 (opened 2026-09-21 against a repository layout that no longer exists)
- **Rules touched:** `SEC-010` (fail closed; deployed configuration is runtime evidence)
- **Files:** `malek-app/src/services/auth-service.ts`, `malek-app/src/services/auth-service.test.ts`

## Context

Production reported PostgREST requests returning `401` while the deployed Supabase URL/key and the
RLS/grants were correct. The browser was the difference: `supabase.auth.getSession()` restores the
locally persisted session and only compares `expires_at` against the local clock
(`@supabase/auth-js@2.105.1`, `GoTrueClient#__loadSession`). A token the server has since revoked —
signed out on another device, rotated signing secret, deleted user — still passes that check,
unlocks the authenticated shell, and then every PostgREST request built from it answers `401`.

So the shell trusted a credential that no authority had confirmed.

## Decision

`getCurrentSession()` now asks the Auth server to rule on the exact token the browser holds, before
returning a session to `AuthProvider`. Outcomes are separated by *who refused*:

| Outcome | Trigger | Behaviour |
| --- | --- | --- |
| `accepted` | `auth.getUser()` returns a user | Return the stored session unchanged. No token rotation. |
| `rejected` | `401`/`403`, or a code in `REVOKED_SESSION_CODES` | Attempt exactly one `refreshSession()`. |
| `unverifiable` | transport failure, timeout, `5xx`, throttling | Keep the session and continue; re-checked at the next bootstrap. |

Repair then splits the same way:

- refresh returns a session → use it (the server has just issued that token);
- refresh is **refused** → `clearStoredSession()` and open the login screen;
- refresh is **unreachable** → return `null` (shell stays closed) **without** clearing storage, so a
  reload recovers without re-entering credentials.

## Why this is not "refresh on every load"

The obvious fix — always call `refreshSession()` at bootstrap — costs a refresh-token rotation on
every page load and invalidates the credential copy held by other tabs. Verification first
(`getUser()`) costs the same one round trip, answers the actual question ("does the server accept
this token?"), and leaves an accepted token alone.

## Why "unverifiable" keeps the session

A network failure is not a decision about a credential. Clearing on it converts a flaky connection
into a forced sign-out on a shared office device. Reads are already paused while offline
(`malek-app/src/app/providers/query-client.ts`, `networkMode: 'online'`), so an unverified session
cannot reach PostgREST until connectivity returns — and by then the next bootstrap re-verifies.

## Boundary this decision does **not** cross

Verifying against Auth cannot repair a project whose PostgREST signing key disagrees with Auth's, nor
a misconfigured `apikey`/role mapping. Those remain hosted-configuration evidence under `SEC-010` and
are still `NO_LOCAL_PROOF` (`GAP-021`). Nothing here is proven against a hosted project; the proof is
local unit behaviour at a fixed `@supabase/auth-js` version.

## Rejected alternative — CSP `wasm-unsafe-eval`

PR #1832 also widened the production CSP. It was dropped: `@electric-sql/pglite` is a **root
devDependency used only by tests**, so no WebAssembly is shipped in the bundle and the relaxation
would have weakened the policy for a capability the product does not use.
