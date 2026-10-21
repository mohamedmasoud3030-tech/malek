# v1.0.0-rc.2 — verified source snapshot

> **Status: NOT A PRODUCTION RELEASE.** This is a frozen, verified source snapshot of MALEK.
> It proves what the repository can prove about itself. It does not prove hosted behaviour,
> legal validity, or a real operating cycle. Read [What this snapshot does not prove](#what-this-snapshot-does-not-prove).

| Field | Value |
| --- | --- |
| Version | `v1.0.0-rc.2` |
| Commit | `61e01ce32d623f8c4e9aded9e0f297edd5d52b42` |
| Verified commit | `ab875a08d3509090dc98371e505d5c0d0155a3ca` — only evidence/release metadata changed since |
| Generated | 2026-10-21T04:41:43.187Z |
| Node / pnpm | v22.22.3 / 10.11.1 |
| Tracked files | 1792 (15.7 MiB) |
| Lockfile SHA256 | `d7fe04e231c4379a7e8840586063144741e21c5f192a8650bab17d158c204ab5` |

## What was verified to build this snapshot

Local gate (`pnpm gate:local --full`) — **19/19 steps passed**, mode `full`:

| Step | Status | Duration |
| --- | --- | ---: |
| `check:docs` | PASS | 0.4s |
| `check:wiki` | PASS | 0.3s |
| `check:business-rules` | PASS | 0.3s |
| `check:execution-plan` | PASS | 0.4s |
| `check:migration-hygiene` | PASS | 0.3s |
| `check:enterprise-freeze` | PASS | 0.4s |
| `check:gl-write-boundary` | PASS | 0.3s |
| `check:workflow-honesty` | PASS | 0.3s |
| `check:sensitive-writes` | PASS | 0.3s |
| `check:sensitive-writes-tests` | PASS | 0.5s |
| `typecheck` | PASS | 22.8s |
| `app:architecture` | PASS | 0.5s |
| `app:typecheck-tests` | PASS | 24.8s |
| `app:a11y-primitives` | PASS | 1.9s |
| `app:frontend-db-contract` | PASS | 0.7s |
| `check:sql-signatures` | PASS | 4.1s |
| `db0:gate` | PASS | 56.4s |
| `app:test` | PASS | 8m 20s |
| `build` | PASS | 14.5s |

Executable evidence (`pnpm evidence:live`) — **18 gaps mapped to 17 proof units** run against a real PostgreSQL 18 engine:

| Status | Gaps |
| --- | ---: |
| PROVEN_LOCALLY | 14 |
| NO_LOCAL_PROOF | 4 |

- **Proven locally (14):** GAP-001, GAP-003, GAP-006, GAP-007, GAP-008, GAP-009, GAP-010, GAP-011, GAP-013, GAP-014, GAP-015, GAP-016, GAP-017, GAP-018
- **Not provable locally (4):** GAP-019, GAP-020, GAP-021, GAP-022

## What this snapshot does not prove

The environment that produced it has no Docker, no hosted Supabase project, no browser and no
credentials. Therefore none of the following is established by this snapshot, for any module:

- Supabase Auth service (JWT issuance, sessions, hooks)
- PostgREST HTTP layer
- Supabase Storage
- Browser rendering and Playwright journeys
- Hosted configuration, secrets, grants at the deployed SHA
- Legal opinion and pilot operations

Consequently the following gaps remain open and are **not** closed by this release:

- GAP-019, GAP-020, GAP-021, GAP-022
- the hosted half of the 14 locally-proven gaps (see `docs/evidence/live-evidence.md`).

## Scope

- **Included:** OWNER_AGENCY rental operations — properties, units, people, contracts, billing,
  collections, expenses, owner settlements, accounting/GL, reports, documents, settings,
  permissions, maintenance, utilities, AI assistant, tenant/owner portals.
- **Explicitly excluded:** MASTER_LEASE (GAP-012), per [ADR 0019](../../decisions/0019-rc1-scope-owner-agency-only.md).
- **Not permitted in this snapshot:** S09 historical correction activation. It requires the
  accounting sign-off described in [the S08 packet](../../accounting/S08_SIGN_OFF_PACKET_AR.md) (`REL-004`).

## Integrity

`SHA256SUMS` in this directory lists the SHA-256 of every one of the 1792 tracked files.
Verify a checkout with:

```bash
sha256sum -c docs/releases/v1.0.0-rc.2/SHA256SUMS --quiet
```

## Reproducing

```bash
git checkout 61e01ce32d623f8c4e9aded9e0f297edd5d52b42
corepack pnpm install --frozen-lockfile --ignore-scripts && corepack pnpm rebuild esbuild
corepack pnpm gate:local --full
corepack pnpm evidence:live
node scripts/release/build-release.mjs --version v1.0.0-rc.2
```

Expected: the gate reports every step PASS, the evidence layer reports the same gap statuses,
and `MANIFEST.json` reproduces the same lockfile hash and file count.
