# MALEK — Technical Decisions

> Engineering decision record for this assessment. It does not override locked product/accounting/legal decisions.

## Decision criteria

Correctness and isolation first, then maintainability, compatibility, operational cost, reversibility and current official support. Existing React/Vite/Supabase architecture is retained unless a measured defect requires a narrow change.

## Decisions

| ID | Decision | Alternatives considered internally | Decisive reason | Reversibility |
|---|---|---|---|---|
| TD-01 | Keep React + Vite + Supabase + TanStack Query/Router | rewrite framework/backend | no proven architectural blocker; rewrite increases data/auth risk | n/a |
| TD-02 | Keep PostgreSQL/RPC/RLS as mutation authority | browser validation or generic REST writes | money/company invariants require transactional server authority | additive/forward migrations |
| TD-03 | Patch DOMPurify through workspace override `>=3.4.13` | wait for jsPDF release; replace PDF stack | smallest immediate fix for a current production XSS advisory | one-line override/lock rollback |
| TD-04 | Enforce AI quota in PostgreSQL using caller JWT | worker Map only; paid Redis; provider-only limits | distributed, transactional, company-aware, no new paid service or secret | table/RPC additive and removable |
| TD-05 | Keep worker-local AI limiter as a burst prefilter, not authority | remove it | sheds hot-worker bursts cheaply while DB counter handles cross-worker truth | easy |
| TD-06 | Bound outbound Auth/quota/provider calls | platform timeout only; retry provider | avoids hung UX and paid edge occupancy; AI request is safe to retry manually | constants adjustable |
| TD-07 | Fail AI closed if quota/membership verification is unavailable | allow provider request | cost and inactive-account abuse outweigh temporary availability | copy/config only |
| TD-08 | Remove CSP `unsafe-eval`; retain `unsafe-inline` temporarily | static nonce; full hash generation now | eval is unnecessary; static nonce is false security; inline bootstrap removal needs deployment-aware work | header change |
| TD-09 | Add `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` | leave `default-src` only | reduces plugin/base/form exfiltration with no app requirement | header change |
| TD-10 | Centralize upload validation at storage service boundary | UI-only validation | hooks/services can bypass UI; boundary defense is maintainable | pure client validation |
| TD-11 | Derive storage extension from verified MIME | preserve filename extension | blocks extension confusion/path surprises while retaining original name in metadata elsewhere | easy |
| TD-12 | Preserve route-driven chunks; do not add global `manualChunks` | targeted vendor groups; generic vendor chunk | experiment reduced a named chunk but violated the landing performance contract and did not prove lower total startup bytes | decision can be revisited after real trace |
| TD-13 | Do not retry deterministic query failures | retry all twice; disable all retries | 401/403/42501/404/abort cannot heal by immediate repetition; transient network/5xx/429 can | policy function |
| TD-14 | Keep PWA caching to navigation shell and static assets | cache API/Supabase data for offline writes | avoids caching tenant/financial responses or implying offline write authority | config guard |
| TD-15 | Preserve current DB migration/replay system | ORM migration rewrite | 281 migrations and DB0 contract are proven; replacement adds drift | n/a |
| TD-16 | Treat live backup, monitoring and deployment as external gates | infer readiness from local tests | credentials/environment evidence cannot be fabricated | external |

## Version-sensitive evidence

- Current Vite supports manual chunks, but official support alone is not evidence that forcing optional vendors into entry dependencies improves this application. The repository landing contract correctly blocked the unproven optimization.
- Supabase documents bounded Edge Function runtime/idle limits; explicit shorter application timeouts prevent waiting for platform termination.
- DOMPurify 3.4.13 is the patched current line for GHSA-55q2-fjhq-7xh7.
- MDN warns that `unsafe-eval` defeats a major CSP protection; no production need was found in the built app.

## Major architecture decision

No major rewrite is recommended. The measured issues were solved incrementally. The only later structural candidate is moving AI aggregate context from browser pagination to a company-scoped summary RPC when real tenant scale proves browser aggregation too expensive. That change can be additive and does not justify a frontend/backend replacement.
