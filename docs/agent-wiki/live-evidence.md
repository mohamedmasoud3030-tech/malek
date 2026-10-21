# Live evidence layer

> **Recorded:** 2026-10-21 · **Repository state:** `malek@d64703003c84`
> **Authority:** agent memory only — see [index](index.md).

## What it is

`pnpm evidence:live` executes a curated set of proof units — mostly Vitest files that run against a
real PostgreSQL 18 engine (PGlite, replayed from `supabase/migrations`) — and maps the results onto
gap IDs. It writes:

- `.gate/live-evidence.json` — machine-readable, gitignored
- `docs/evidence/live-evidence.md` — committed, SHA-stamped report

Registry: `scripts/live-evidence/registry.mjs`. Runner: `scripts/live-evidence/run.mjs`.

## Result at `d647030`

| Status | Gaps |
| --- | --- |
| `PROVEN_LOCALLY` | 14 (17 proof units, ~200 assertions) |
| `NO_LOCAL_PROOF` | 4 — GAP-019 legal, GAP-020 browser, GAP-021 hosted, GAP-022 pilot |

## The rule this page exists to protect

**`PROVEN_LOCALLY` is not `CLOSED`.** It means every mapped unit ran and passed at that revision
against a real database engine. It says nothing about:

- Supabase Auth (JWT issuance, sessions, hooks) — emulated here only as a `request.jwt.claims` GUC;
- PostgREST, Storage, or any HTTP layer;
- browser rendering or Playwright journeys;
- hosted configuration, secrets, grants at the deployed SHA;
- legal opinions or a real operating cycle.

Each gap in the artifact carries a `remaining` field naming exactly what local proof cannot cover and
an `authority` field naming who owns it.

## Adding evidence

Add a unit to `PROOF_UNITS` only after reading the test titles and confirming they exercise the gap's
subject. Mapping a gap to a vaguely-related passing file is the same dishonesty as claiming a skipped
CI job is a pass. The runner refuses a registry entry with no `remaining` statement.

## Related

- [gap-execution-board.md](gap-execution-board.md) — per-gap disposition.
- `docs/accounting/S08_SIGN_OFF_PACKET_AR.md` — the accounting signature that unblocks GAP-015/016.
- `docs/operations/HOSTED_EVIDENCE_RUNBOOK_AR.md` — the hosted steps that unblock the other 12.
