---
name: systematic-debugging
description: Use when encountering any bug, test failure, unexpected behavior, or build or integration failure. Find the root cause before proposing or making any fix.
---

# Systematic Debugging

Find the root cause before fixing. Symptom fixes are failure.

**Core principle:** NO FIXES WITHOUT ROOT-CAUSE INVESTIGATION FIRST.

## Use when

- Any bug, failing test, unexpected behavior, performance problem, or build or
  integration failure.

## Do NOT use when

- Nothing is broken yet (this is for failures, not new work).

## Workflow — four phases, in order

1. **Root-cause investigation**
   - Read error messages and stack traces completely.
   - Reproduce consistently; record the exact steps.
   - Check recent changes (git log/diff, config, dependencies, environment).
   - Trace the data flow to where the bad value originates.
2. **Pattern analysis**
   - Find similar working examples; compare fully.
   - List every difference — do not assume "that can't matter".
3. **Hypothesis and test**
   - State ONE hypothesis ("X is the cause because Y"). Test it with the
     smallest possible change, one variable at a time. If it fails, form a new
     hypothesis — do not pile on more fixes.
4. **Implementation**
   - Write a failing regression test first (use `test-driven-development`).
   - Apply the single root-cause fix and verify. No "while I'm here" changes.
   - If three or more distinct fixes have failed: STOP and question the
     architecture rather than attempting fix #4 — and surface it to the owner.

## Red flags — STOP and return to phase 1

- "Quick fix for now" / "just try changing X" / "I don't fully understand but
  this might work" / proposing fixes before tracing the cause.

## Exit criteria

- Root cause identified, and a regression test proves the fix (red → green).

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
