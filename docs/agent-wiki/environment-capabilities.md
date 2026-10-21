# Environment capabilities

> **Recorded:** 2026-10-21 · **Repository state:** `malek@f2b6de55593e611f8e7713fb21e14cad14fbf67a` (clean tree)
> **Authority:** agent memory only — see [index](index.md).

This page exists because an agent that assumes a capability it does not have will either waste an hour
or, worse, write "verified" in a report for something it never ran. Everything below was measured in
this sandbox, not inferred.

## Summary

| Capability | Available | Consequence |
| --- | --- | --- |
| Node.js + pnpm install | **Yes** | Node `22.22.3`, corepack pnpm `10.11.1`. Install is fast and offline-repeatable after the first run. |
| TypeScript / build / unit tests | **Yes** | Source-level proof is fully available. |
| PostgreSQL replay + RLS/isolation audit (**PGlite**) | **Yes** | `pnpm db0:gate` runs the real migration chain in WASM. **No Docker needed.** |
| Docker / local Supabase stack (`supabase start`) | **No** | `docker` is not installed. Hosted-parity local Auth/Storage/PostgREST is impossible here. |
| Hosted Supabase / QA project | **No credentials** | `pnpm qa:preflight` fails closed by design. Any hosted claim stays unproven. |
| Browser automation (Playwright) | **No** | No browsers installed, and the Playwright CDN is unreachable. No screenshots, no clicking. |
| GitHub (`gh`, `git` push) | **Yes** | PRs, checks, issues and branches are usable. |
| General internet | **Restricted** | Egress only to `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`. |

## Evidence

### Node, pnpm and install

```text
node --version      -> v22.22.3
corepack pnpm -v    -> 10.11.1          (matches package.json "packageManager")
pnpm install --frozen-lockfile --ignore-scripts  -> 633 packages, 10.1 s (cold, empty store)
pnpm install --frozen-lockfile                   -> "Already up to date", 0.98 s
```

`--ignore-scripts` followed by `pnpm rebuild esbuild` is the sequence CI uses
([ci.yml](../../.github/workflows/ci.yml)); that is the **verified cold path** (empty store, 633
packages, 10.1 s). A warm `--frozen-lockfile` re-run also succeeded (0.98 s) with `onlyBuiltDependencies`
in [package.json](../../package.json) approving esbuild, core-js and supabase. A *completely cold*
plain install (without `--ignore-scripts`) was **not** tested. Neither form modified `pnpm-lock.yaml`
(tree stayed clean).

> **Toolchain drift:** CI pins Node **24** in every workflow ([ci.yml](../../.github/workflows/ci.yml),
> `node-version: 24`); this sandbox has Node **22**. A local pass is not proof of a CI pass. See
> [known-traps.md](known-traps.md).

### PGlite database gates (the important one)

`pnpm db0:gate` completed in **59.1 s** with **7/7 gates PASS** at this commit, reporting:

```text
Tenant tables checked : 107
Policies checked      : 255
Functions checked     : 413
Views checked         : 11
contract findings     : 16  (accepted baseline 46, all DB0-07)
```

Two of the seven sub-gates printed **skipped**, not passed:

- `idempotency` — "skipped for the single canonical dump bootstrap (not a forward incremental migration)"
- `role-model` — "skipped for the single canonical dump bootstrap"

So "7/7 passed" at this commit means five gates ran and two were skipped by design. Do not report the
skipped two as evidence. Details in [gate-inventory.md](gate-inventory.md).

### What is impossible here, and therefore must be reported as an external gap

- Any `GAP-003` / `GAP-019` / `GAP-020` / `GAP-021` / `GAP-022` evidence — these need a live hosted
  project, legal input, or a real operating cycle.
- Reproducing CI's browser matrix (`browser-readiness.yml`).
- Reproducing `release-blocker-gate.yml`'s ephemeral Supabase Auth/Storage lifecycle, which needs Docker.
