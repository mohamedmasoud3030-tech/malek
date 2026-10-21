# Releases

Each directory here is a **verified source snapshot**, produced by
`node scripts/release/build-release.mjs --version <vX.Y.Z-rc.N>` and never written by hand.

A snapshot contains:

| File | Purpose |
| --- | --- |
| `MANIFEST.json` | Version, commit, toolchain, lockfile hash, per-file SHA-256, and the verification results recorded at that exact commit. |
| `SHA256SUMS` | Flat checksum list; verify with `sha256sum -c SHA256SUMS --quiet`. |
| `RELEASE.md` | Human release note: what was verified, what this snapshot does **not** prove, and the exact commands to reproduce it. |

## Why a snapshot is not a release

A snapshot proves what the repository can prove about itself: typecheck, lint-equivalents,
architecture guards, database gates, 4,000+ tests, a production build, and engine-level proof for the
mapped gaps. It cannot prove hosted behaviour, browser journeys, legal validity or a real operating
cycle, because the build environment has no Docker, no hosted project, no browser and no credentials.

Every `RELEASE.md` therefore opens by saying it is **not a production release**, and repeats the
`NO_LOCAL_PROOF` gaps verbatim.

## Index

| Version | Commit | Status |
| --- | --- | --- |
| `v1.0.0-rc.1` | see its `MANIFEST.json` | verified source snapshot — not production ready |
