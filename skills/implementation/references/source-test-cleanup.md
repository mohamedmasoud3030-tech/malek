# Source, test and cleanup reference

## Source hierarchy

1. repository-pinned version and local configuration;
2. official docs for that version;
3. official upstream repository/changelog;
4. standards/specifications;
5. secondary sources only for context.

## Test selection

- pure/domain logic → unit test;
- service + database contract → integration/PGlite/Supabase contract;
- component interaction → React Testing Library/Vitest;
- full journey/navigation → Playwright/runtime proof;
- RLS/authorization → positive and negative DB tests, including cross-company denial.

A bug reproduction test must fail because of the bug, not a broken fixture.

## Cleanup search

Search for old route names, duplicate exports/re-exports, compatibility aliases, unused adapters/helpers, obsolete tests/fixtures, stale source-of-truth references, superseded DB/RPC names, debug output and temporary/generated artifacts.

## Research basis

- Source-driven development: https://github.com/addyosmani/agent-skills/blob/main/skills/source-driven-development/SKILL.md
- Test-driven development: https://github.com/addyosmani/agent-skills/blob/main/skills/test-driven-development/SKILL.md
- Incremental implementation: https://github.com/addyosmani/agent-skills/blob/main/skills/incremental-implementation/SKILL.md
