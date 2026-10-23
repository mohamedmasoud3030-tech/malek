---
name: verification-before-completion
description: Use before claiming any work is complete, fixed, or passing. Run the verification commands and confirm fresh output before making any success claim; evidence before assertions, always.
---

# Verification Before Completion

**Core principle:** evidence before claims, always. No completion claim without
fresh verification evidence.

## The gate — applicability-aware

Before claiming any status:

1. **IDENTIFY** which checks actually prove this claim (categories below).
2. For each APPLICABLE check, **RUN** the full command now (fresh, complete).
   For NOT APPLICABLE, record "N/A" and why. For REQUIRED BUT UNAVAILABLE,
   report the missing capability — do not invent a passing result.
3. **READ** the output; check exit codes and failure counts.
4. **VERIFY** the output confirms the claim; otherwise state the actual status.
5. Only then make the claim, citing the output.

## Categories by change type

- **Code change** — tests, lint, typecheck, build, relevant
  integration/permission/tenant checks, requirement-by-requirement.
- **Skill/doc change** — structural checks (frontmatter, triggers, links),
  content review.
- **Documentation-only** — content + link/path validation.

In every case:

- [ ] Each category classified APPLICABLE / N-A / REQUIRED-BUT-UNAVAILABLE
      with a one-line reason.
- [ ] Every APPLICABLE check run fresh, result recorded.
- [ ] Missing capabilities reported as gaps, never silently passed.
- [ ] Every requested item verified item-by-item or reported not-done.
- [ ] Every claim cites output produced in THIS session.

## Common failures

| Claim | Requires fresh output of |
|---|---|
| Tests pass | the test command, 0 failures |
| Lint clean | the lint command, 0 errors |
| Build succeeds | the build command, exit 0 |
| Bug fixed | original symptom reproduced, then passing |
| Requirements met | item-by-item verification |

## Red flags — STOP and run the command

- "should", "probably", "seems to", success statements before verifying.
- Trusting a previous run or another agent's report as evidence.

> 🏛️ Portfolio binding: canonical master lives in `command-center-/skills/`.
> This is the portfolio's Definition of Done gate.
