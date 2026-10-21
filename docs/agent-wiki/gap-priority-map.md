# Gap priority map

> **Recorded:** 2026-10-21 · **Repository state:** `malek@f2b6de55593e611f8e7713fb21e14cad14fbf67a`
> **Authority:** agent memory only — see [index](index.md).
> **Source of record:** [Document 7 gap register](../source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md)
> and [Document 8 work packages](../source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md).

This page does **not** re-adjudicate any gap status. Document 7 owns status; Document 8 owns work
packages. What this page adds is a different axis that neither document organises by: **what kind of
blocker is in the way**, because that determines whether an agent can act at all.

The grouping below is this wiki's synthesis (2026-10-21) of the tables in Documents 7 and 8.

## 23 gaps, grouped by blocker

### A. Needs an owner decision before code can proceed

| Gap | Why code alone cannot close it |
| --- | --- |
| GAP-001 — role assignment cannot express approved job separation | Document 8, WP-01 lists "product-owner mapping from existing three roles/data to six roles" as a dependency. Inventing the mapping is prohibited. |
| GAP-019 — legal validity/registration policy | External legal/regulatory input. |
| GAP-012 — master lease not operable/reportable | WP-04 depends on an "explicit release inclusion decision" before building the module. |
| *(not a gap, but a hard gate)* S08 accounting approval | Document 8 `REL-004`: S09 correction may not start until the read-only analysis is approved. This also blocks GAP-015/GAP-016 from being *operated*, not just built. |

### B. Needs credentials or an environment this sandbox does not have

| Gap | Missing capability |
| --- | --- |
| GAP-003 — multi-company isolation proof | hosted Auth/RLS negative tests at the release SHA |
| GAP-013 — control accounts vs schedules | hosted reconciliation evidence |
| GAP-014 — financial statements complete | hosted evidence |
| GAP-015 — historical state frozen | deployed/frozen baseline |
| GAP-016 — historical errors corrected safely | hosted S08→S09 lifecycle |
| GAP-017 — bank imports operational | hosted journey |
| GAP-020 — operators face broken/competing flows | real browser (`GAP-023` resolved) |
| GAP-021 — repository vs deployment truth | deployment access |
| GAP-022 — no proven real operating cycle | one-office pilot |

### C. Engineering-closeable without new credentials

These are the only gaps where an agent in a Docker-less, credential-less sandbox can make real
progress beyond documentation. Assume the repository work is partly or wholly done and the task is
**finding the specific remaining hole**, not building from scratch:

- GAP-006 / GAP-007 — collection-role mapping and fixed-fee accrual (Document 7 records engineering
  closeout rows; verify at your SHA).
- GAP-008 — Due-from-Owner lifecycle.
- GAP-009 — governed deposit lifecycle.
- GAP-010 — versioned tax authority (professional/legal confirmation still separate).
- GAP-011 — posted adjustments fragmentation.
- GAP-018 — sensitive mutation surface (static scan + guard exist; deployed grants unverified).
- GAP-012 — master-lease module completion, **if** the owner decides to include it in release scope.

### D. Already resolved

GAP-002, GAP-004, GAP-005, GAP-023 — recorded as resolved in Document 7 at its baseline. Re-verify
before citing; do not re-open without evidence.

## Release-blocking count

Document 7 marks 18 of the 23 as release-blocking. Of those, the sandbox can only touch group C.

## Practical consequence

An agent that reports "worked the gap register" without saying which group it touched has produced an
unfalsifiable claim. State the group: decision, credential, or code.
