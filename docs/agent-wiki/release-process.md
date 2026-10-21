# Release process

> **Recorded:** 2026-10-21 · **Repository state:** `malek@1cc3d82ae3e7` (first full-gate green commit of the `v1.0.0-rc.1` cycle)
> **Authority:** agent memory only — see [index](index.md).

## Producing a snapshot

```bash
corepack pnpm install --frozen-lockfile --ignore-scripts && corepack pnpm rebuild esbuild
corepack pnpm gate:local --full      # 19 steps incl. app tests (~9 min) and build
corepack pnpm evidence:live          # 17 proof units against PostgreSQL 18
node scripts/release/build-release.mjs --version vX.Y.Z-rc.N --archive
```

Outputs: `docs/releases/<version>/{MANIFEST.json,SHA256SUMS,RELEASE.md}` and an archive under
`dist/release/` (gitignored).

## The rule the builder enforces

`build-release.mjs` **refuses** unless `.gate/last-run.json` and `.gate/live-evidence.json`:

- exist,
- record the *current* commit,
- show zero failures,
- and `last-run.json` is in `full` mode (tests + build, not the quick subset).

It also refuses a dirty working tree outside the release directory. This makes it structurally
impossible to attach another commit's evidence to a release — the failure mode `REL-001` forbids.

## Naming

A tag here is a **verified source snapshot**, never a production release. The release note states in
its first line that it is not a production release, and lists the six classes of proof the build
environment cannot produce (Auth, PostgREST, Storage, browser, hosted config, legal/pilot).

## Adding CI later

The two natural CI additions are `pnpm check:wiki` and `pnpm check:sensitive-writes` (already in
`gate:local`, not in `ci.yml`). That is a workflow change and must satisfy
`check-workflow-honesty`; it was deliberately left to a human-reviewed PR.
