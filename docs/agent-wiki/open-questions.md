# Open questions

> **Recorded:** 2026-10-21 · **Repository state:** `malek@f2b6de55593e611f8e7713fb21e14cad14fbf67a`
> **Authority:** agent memory only — see [index](index.md).

Questions only the owner can answer. Each entry states the consequence of each answer so the decision
can be made without re-reading the repository.

## 1. GAP-001 — what is the approved six-role mapping? (blocks WP-01 and every approval flow)

Document 8 requires a "product-owner mapping from existing three roles/data to six roles". Until that
exists, any role migration would be an invented business rule, which [AGENTS.md](../../AGENTS.md)
prohibits.

- **If answered:** WP-01 becomes the highest-leverage engineering work available, and GAP-002/GAP-018
  can be re-verified against a real model.
- **If deferred:** every permission, maker-checker and isolation claim stays `PARTIAL`/`BLOCKED`,
  regardless of code merged.

## 2. Should the repository adopt a real linter?

Today `lint` is `tsc --noEmit`; CI's "Lint" step adds no signal, and SonarCloud is the only
static-analysis product.

| Option | Cost | Benefit |
| --- | --- | --- |
| Adopt ESLint with type-aware correctness rules + changed-files ratchet | new devDependencies, CI time, a baseline file | catches floating promises, hook-deps, unsafe async around financial writes |
| Keep `tsc` only, rename the CI step to "Typecheck" | trivial | stops a misleading claim; no new safety |
| Rely on SonarCloud | none | already running; not a blocking quality gate |

The minimum honest fix is the rename, whichever way the rest goes.

## 3. Can this session receive hosted QA credentials?

`pnpm qa:preflight` needs `QA_ENVIRONMENT_KIND`, `QA_SUPABASE_PROJECT_REF`,
`PRODUCTION_SUPABASE_PROJECT_REF`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `QA_ADMIN_EMAIL`,
`QA_ADMIN_PASSWORD` — and refuses production. Without them, group B gaps in
[gap-priority-map.md](gap-priority-map.md) are unreachable.

**Never provide a service-role key in chat.** An anon key plus a QA user is sufficient for the
read-only preflight.

## 4. Is there an approved S08 accounting sign-off?

Document 8 `REL-004` and the database-level gate both block S09 correction until the read-only analysis
is approved. If an approval exists, its reference should be recorded; if it does not, no historical
correction may be scheduled this session.

## 5. Should the wiki be linked from `AGENTS.md`?

`AGENTS.md` is the contributor entry point. The wiki is currently discoverable only from `docs/`.

- **If yes:** one line in `AGENTS.md` ("Session memory: `docs/agent-wiki/index.md`") makes it findable;
  it is a change to a contributor-facing file and should be deliberate.
- **If no:** agents will keep re-deriving the facts in [environment-capabilities.md](environment-capabilities.md).

## 6. Is MASTER_LEASE (GAP-012) in RC1 release scope?

Document 8 makes WP-04 depend on an "explicit release inclusion decision".

- **In scope:** a full module (UI → service → RPC → reporting → reconciliation) is required, and it is
  engineering-closeable in this sandbox.
- **Out of scope:** the release must *truthfully exclude* it, and no "partially done master lease"
  claim may appear in release notes.

## 7. Should the stale documentation baselines be refreshed?

Documents 7/8 and the status ledger cite `da9a98a3`, `8ada4e7e`, `9e5c32e8`, `0b4756df` — none is
`f2b6de5`. Refreshing them is a Canonical Pack change and therefore a governed edit, not housekeeping.
Until decided, the wiki records the drift only.
