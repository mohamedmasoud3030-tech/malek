---
name: implementation
description: Use when implementing or refactoring MALEK application code or fixing a bug. Enforces repository-first inspection, official-source verification for changing technologies, prove-it tests for bugs, incremental implementation, removal of superseded code, and exact validation.
---

# Implementation

This is the default coding skill for MALEK features, bug fixes and refactors.

## 1. Baseline

- Read `AGENTS.md`, relevant canonical rules and matching code before editing.
- Record branch/base and inspect overlapping work when possible.
- Search before creating; reuse the established abstraction that already owns the behavior.
- Treat package manifests/configuration as the source for the stack actually installed.

## 2. Source-driven decisions

When correctness depends on a framework/library API, configuration, security behavior or migration rule:

1. identify the exact repository-pinned version;
2. consult official documentation or upstream repository;
3. prefer version-matched examples;
4. mark anything still unverified instead of presenting memory as fact.

Repository conventions still override generic examples.

## 3. Prove behavior

For a deterministic bug fix, use the Prove-It sequence: failing reproduction test → confirm correct failure → smallest repair → same test passes → relevant regression set.

For new testable logic, prefer RED → GREEN → REFACTOR. Do not manufacture low-value tests for documentation-only or purely visual work.

## 4. Implement in coherent slices

- Validate a narrow slice before broadening.
- Do not get green by skipping tests, weakening assertions, adding broad ignores or hiding type errors.
- Preserve canonical IA, shared UI primitives and trust boundaries.

## 5. Remove the old path

When replacing behavior, search all references, move remaining consumers, and delete dead exports, aliases, wrappers, adapters, tests, docs and temporary artifacts in the same change. Preserve compatibility only for a proven active consumer or migration window, with a removal condition.

Do not finish with two active ways to perform the same operation unless the architecture explicitly requires both.

## 6. Validate and review

Run narrow checks first, then broaden by risk. For changed user journeys, perform the runtime/browser loop required by `AGENTS.md` when available. Before PR/merge, use the `review` skill on the complete diff.

Read `references/source-test-cleanup.md` for source hierarchy, test selection and cleanup.
