---
name: test-driven-development
description: Use when implementing any feature, bugfix, or behavior change. Write the failing test first, watch it fail, then write the minimal code to pass — before writing any implementation code.
---

# Test-Driven Development

Write the test first. Watch it fail. Write minimal code to make it pass.

**Core principle:** if you did not watch the test fail, you do not know it
tests the right thing.

## Use when

- New features, bug fixes, refactoring, and behavior changes.

## Do NOT use when

- Throwaway prototypes, generated code, or config-only changes — and only
  then after surfacing the exception to the owner.

## The iron law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

If you wrote implementation code first: delete it and start from the test.

## Workflow — RED → GREEN → REFACTOR

1. **RED** — write one minimal failing test for one behavior. Real code, clear
   name, no unnecessary mocks.
2. **Verify RED** — run it. It must fail for the right reason (missing
   behavior), not a typo. If it passes, you are testing existing behavior:
   fix the test.
3. **GREEN** — write the simplest code that makes the test pass. Nothing more.
4. **Verify GREEN** — run it. It passes and no other test broke.
5. **REFACTOR** — only after green: remove duplication, improve names. Keep
   green; add no behavior.
6. Repeat for the next behavior.

## Rationalizations that mean "start over"

- "Too simple to test" / "I'll test after" / "already manually tested."
- "Keep the code as reference while I write tests."
- Tests written after implementation pass immediately and prove nothing — you
  never watched them fail.

## Exit criteria

- Every behavior has a test that you watched fail, then pass.
- Before claiming the work is complete, apply `verification-before-completion`.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
