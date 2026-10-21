# Changelog

All notable changes to MALEK. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versions follow [Semantic Versioning](https://semver.org/).

> **Reading this file:** a version here is a **source snapshot**, not a production release. Production
> readiness is governed separately by `docs/source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md`
> and is never implied by a changelog entry. Every entry names the evidence that existed at that commit.

## [Unreleased]

Nothing yet.

## [1.0.0-rc.1] — 2026-10-21

First frozen, verified source snapshot. Commit recorded in `docs/releases/v1.0.0-rc.1/MANIFEST.json`.

### Added

- **Agent environment layer** — `docs/agent-wiki/` (dated, commit-cited memory), `pnpm gate:local`
  (one-command credential-free verification), `pnpm check:wiki` (wiki consistency guard).
- **Executable evidence layer** — `pnpm evidence:live` maps 18 open gaps to 17 proof units and runs
  them against a real PostgreSQL 18 engine, producing a SHA-stamped report. Result: 14 gaps proven
  locally, 4 not provable locally (legal, browser, hosted, pilot).
- **SEC-009 sensitive-write guard** — `scripts/check-sensitive-financial-write-boundary.mjs` with 10
  negative tests. Document 7 cited this guard as proof; the file did not exist, so the boundary had no
  automated protection. It now scans 688 production files against 12 sensitive tables.
- **SQL signature documentation guard** — `pnpm check:sql-signatures` replays the schema and verifies
  every function signature declared in marked operating documents.
- **Gap evidence audit** — `pnpm audit:gaps` resolves every citation in the 23-gap register to a file
  or database object and reports what cannot be resolved.
- **Delivery advisory** — `docs/advisory/2026-10-21-delivery-consultation-ar.md`, covering scope,
  critical path, risk and owner decisions to delivery.
- **S08 sign-off packet** — `docs/accounting/S08_SIGN_OFF_PACKET_AR.md`: the bounded question, the
  database-enforced controls, the review queries and the signature block for GAP-015/016.
- **Hosted evidence runbook** — `docs/operations/HOSTED_EVIDENCE_RUNBOOK_AR.md`: the ordered commands
  that convert the hosted half of the gap register into one session of work.
- **Release tooling** — `scripts/release/build-release.mjs` produces a checksum manifest, release note
  and source archive, and **refuses** to run unless gate and evidence artifacts exist at the same commit.

### Changed

- **ADR 0019** — RC1 scope is OWNER_AGENCY only. MASTER_LEASE (GAP-012) is explicitly deferred rather
  than partially shipped; the gap stays open.
- **ADR 0020** — the six-role authorization mapping (ADMIN = Office Owner, MANAGER, ACCOUNTANT,
  OPERATIONS, USER, VIEWER) is adopted as implemented, satisfying WP-01's authored dependency.
- **Document 7** — added an evidence-provenance note: migration filenames cited by the gap register are
  historical pointers after the chain was consolidated into `20260901000000_canonical_baseline.sql`.
  No gap status was changed.
- `.gitignore` — every `*.example` env template is trackable again; `.gate/`, `dist/` release archives
  and `.scratch/` are ignored.

### Fixed

- New `.env.*.example` templates were silently ignored (only the literal `.env.example` was negated).
- `pnpm evidence:live` initially reported 13 false failures due to path resolution; fixed and re-run.

### Not done in this version

- No hosted, browser, legal or pilot verification. GAP-019, 020, 021, 022 need an environment or an
  authority that the build environment does not have.
- S09 historical correction remains gated behind the accounting sign-off (`REL-004`).

### Governance

- Governed stage credit unchanged: `S01 COMPLETE; S02 PARTIAL; S03 PARTIAL; S04 NOT_STARTED; S05 PARTIAL;
  S06 NOT_STARTED; S07 PARTIAL; S08 NOT_STARTED; S09 NOT_STARTED; S10 NOT_STARTED`.
- Affected rule IDs this release cycle: `SEC-009` (guard restored), `REL-001`/`REL-004` (observed).
