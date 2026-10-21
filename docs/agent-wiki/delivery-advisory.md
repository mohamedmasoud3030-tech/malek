# Delivery advisory (2026-10-21)

> **Recorded:** 2026-10-21 · **Repository state:** `malek@0d1de82278116baf47435f7371fcf9cb08c6434f`
> **Authority:** agent memory only — see [index](index.md).

## What it is

A consulting document written for the product owner on 2026-10-21, covering everything MALEK needs
between the current state and delivery:

[`docs/advisory/2026-10-21-delivery-consultation-ar.md`](../advisory/2026-10-21-delivery-consultation-ar.md)

It is `ADVISORY`, not canonical: it changes no rule, grants no stage credit and closes no gap.

## The three claims worth remembering

1. **The bottleneck is evidence, not code.** 15 of the 23 open gaps need a decision or an environment;
   only 8 are code-addressable. Local green (14/14 gates) proves Repository Reality only.
2. **Recommend scope A** — RC1 limited to OWNER_AGENCY, with MASTER_LEASE explicitly excluded in
   writing, and S08/S09 deferred past the pilot. Estimated 14–18 weeks on the critical path,
   10–13 if QA access exists from week 1.
3. **Eight owner decisions gate the plan.** They are tabulated as D-01…D-08 in §8 of the advisory;
   D-01 (the six-role mapping) blocks everything downstream.

## How it was produced

Using the `doc-coauthoring` skill from `anthropics/skills` — adopted as *method*, not vendored code.
Rationale, runner-ups and rejections are recorded in §13 of the advisory itself; the short version is
that SDD frameworks and `superpowers` prescribe their own plan store, which would become a parallel
planning authority and violate the Canonical Pack rule.

A "reader test" was run as a script: all 30 `GAP-`/`WP-`/`REL-`/`S0x` identifiers cited in the advisory
were checked against Documents 7/8 and the master plan — zero invented identifiers.

## How to use it

- Before planning work, read §4 (scope) and §5 (critical path).
- Before reporting status, read §3 (definition of delivery) and §11 (assumptions).
- When the owner answers a decision, record it in
  [session-decisions.md](session-decisions.md) and update §8 of the advisory rather than leaving two
  divergent answer sets.
