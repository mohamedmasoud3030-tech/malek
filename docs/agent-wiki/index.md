# MALEK Agent Wiki

> **Authority:** agent memory only. This wiki records what agents observed and decided, with dates and
> commits. It is **not** a source of truth for product, accounting, permission, security or IA
> behaviour, and it never grants governed stage credit. The
> [MALEK Canonical Pack](../source-of-truth/00_INDEX.md) outranks every page here.
> If this wiki and the Canonical Pack disagree, the Pack wins and this page is wrong.

**Purpose:** stop every new agent from re-deriving the same environment facts, re-hitting the same
traps, and re-reporting stale SHAs as current reality.

**How to use it**

1. Read this index before planning work.
2. Read the page for your task type, not the whole wiki.
3. Before repeating a measurement, check the page's `Recorded` line. If the repository has moved past
   that commit, re-verify rather than trusting the number.
4. When you learn something durable, edit every page it touches *and* this index. Do not create a
   second place for the same fact.

**Format rules**

- Every page states `Recorded: <date> · Repository state: malek@<sha>`.
- Claims about code cite a commit. Claims about behaviour cite a command and its observed output.
- Never write "currently" or "now" without a date or a commit beside it.
- Superseded claims are marked `Superseded by <page/commit>` — they are not deleted. This is a
  historical record.

## Pages

### Environment

| Page | What it answers |
| --- | --- |
| [environment-capabilities.md](environment-capabilities.md) | What this sandbox can and cannot verify: Docker, hosted Supabase, browsers, network egress. |
| [gate-inventory.md](gate-inventory.md) | Every check command, what it really covers, measured runtime, and its blind spots. |
| [known-traps.md](known-traps.md) | Pitfalls that have already cost an agent time. Read before diagnosing a "failure". |

### Strategy

| Page | What it answers |
| --- | --- |
| [gap-priority-map.md](gap-priority-map.md) | The 23 open gaps grouped by what actually unblocks each one: code, credentials, or an owner decision. |
| [open-questions.md](open-questions.md) | Decisions only the owner can make, with the consequence of each answer. |

### Session record

| Page | What it answers |
| --- | --- |
| [session-decisions.md](session-decisions.md) | Dated decisions taken in this session, and what was deliberately *not* changed. |
| [delivery-advisory.md](delivery-advisory.md) | Points to the 2026-10-21 consulting roadmap to delivery, and the three claims that matter. |

## Related repository documents (authoritative, not duplicated here)

- [AGENTS.md](../../AGENTS.md) — contributor/agent entry point and truth-layer rules.
- [DATABASE_RULES.md](../../DATABASE_RULES.md) — database contract rules.
- [Canonical Pack index](../source-of-truth/00_INDEX.md) — the eight canonical documents.
- [Document 7: implementation traceability](../source-of-truth/07_IMPLEMENTATION_TRACEABILITY_AND_REALITY.md) — the 77-rule / 23-gap register.
- [Document 8: closeout roadmap](../source-of-truth/08_CLOSEOUT_ROADMAP_AND_RELEASE_GATES.md) — the seven work packages.
- [skills/README.md](../../skills/README.md) — task procedures to load on demand.
