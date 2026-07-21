# CI Hardening PR Summary

Branch: `fix/ci-hardening-sonar-supabase-diagnostics`
Base inspected: `origin/main` / `0d3b7f32b2992921cd420e38dbf026ec0f595167`
Production rollout: remains `HOLD`; no Production writes were attempted.

## Sonar findings before

Public SonarCloud quality gate on current `main` reported:

- New duplicated lines density: `8.3%` (threshold `<= 3%`).
- New security rating: `C` (threshold `A`).
- New reliability rating: `C` (threshold `A`).
- New/open-period issues fetched: 888 total; 873 code smells, 14 vulnerabilities, 1 bug.

Real issues prioritized for this PR:

- `typescript:S6544` in `rentrix-app/src/services/documents/DocumentRenderer.ts`.
- `githubactions:S6505` findings on workflow dependency installs that allowed general package lifecycle scripts.

Not changed in this PR:

- Historical migrations and pgTAP fixture SQL were not edited. Parser/duplication noise there is handled through path exclusions for immutable history/fixtures only.

## Changes made

- `DocumentRenderer.ts`: replaced `document.fonts?.ready` boolean-condition usage with a separate `fonts` reference, preserving font loading and error behavior.
- GitHub Actions: `pnpm install --frozen-lockfile` changed to `pnpm install --frozen-lockfile --ignore-scripts`, followed by explicit `pnpm rebuild esbuild`. This blocks arbitrary dependency lifecycle scripts while allowing the approved native toolchain package needed by Vite builds.
- `sonar-project.properties`: excluded generated evidence, immutable `supabase/migrations/**`, historical `supabase/migrations_consolidated/**`, and `supabase/tests/**` SQL fixtures from static-analysis duplication/parser noise. Application code and services remain in scope.
- `scripts/collect-supabase-migration-evidence.sh`: now prints local migration versions and, when read-only DB credentials are available, reports both local-only and remote-only ledger drift and fails explicitly without repairing or pushing.

## Local validation

Passed:

- Clean `pnpm install --frozen-lockfile --ignore-scripts` after removing `node_modules`.
- `pnpm rebuild esbuild`.
- `node scripts/ci/verify-tool-versions.mjs`.
- `node scripts/check-doc-links.mjs`.
- Workflow YAML parse check.
- `bash -n scripts/collect-supabase-migration-evidence.sh`.
- `pnpm --filter ./rentrix-app run typecheck`.
- `pnpm --filter ./rentrix-app run lint`.
- `pnpm --filter ./rentrix-app exec vitest run --config vite.config.ts src/services/documents/DocumentRenderer.test.ts`.
- `pnpm --filter ./rentrix-app run check:architecture`.
- Migration evidence no-credential mode for project `nnggcnpcuomwfuupupwg`.
- Migration evidence fake read-only ledger fixture: verified local-only and remote-only drift diagnostics and non-zero failure.

Sandbox-limited / require GitHub Actions rerun:

- `typecheck:test`: killed by sandbox resource limits.
- Full unit tests: all reported test files passed, then Vitest ended with a worker-exit error in the sandbox.
- Financial tests: all reported financial test files passed, then Vitest ended with a worker-exit error in the sandbox.
- Production build: transformed modules but was killed by sandbox limits before completion.
- E2E: not run locally because browser installation/runtime is unavailable in this sandbox.
- Sonar post-change analysis: requires GitHub/SonarCloud CI analysis after pushing the PR.

## Production safety

No commands were run that write to Production. Specifically: no `supabase db push`, no migration repair, no ledger mutation, no DDL/DML, no RLS/RPC/Auth/schema changes, and no operational data writes.
