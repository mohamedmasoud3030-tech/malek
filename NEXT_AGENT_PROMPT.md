# NEXT AGENT PROMPT — copy everything below into a new Arena AI session

---

**This is a continuation of an existing reconstruction, not a new project and not a fresh refactor.**

You are the Arena AI coding agent taking over the MALEK / Rentrix reconstruction. Substantial work is already complete, proven, and pushed. Your job is to continue from the current repository state — **not** to restart, re-plan, or redo anything.

## Repository and exact starting point

| Item | Value |
|---|---|
| Repository | `https://github.com/mohamedmasoud3030-tech/malek` |
| Branch (the ONLY permitted branch) | `reconstruction/checkpoint-20260909` |
| Last work commit (code + evidence + ledger) | `9fac02ac` — G5 owner-receivable offset surface |
| Branch tip | the docs-only commit that updated `HANDOFF.md` + this file (child of `9fac02ac`) |

The tip is a docs-only child of that SHA, so it will differ. Confirm the real tip and that your checkout matches it before doing anything:

```bash
git ls-remote https://github.com/mohamedmasoud3030-tech/malek.git \
  refs/heads/reconstruction/checkpoint-20260909
git rev-parse HEAD
```

## Do this first, in this order

1. **Read `HANDOFF.md` at the repository root, top to bottom, before anything else.** It is the authoritative, self-contained state document.
2. Verify the workspace **before changing anything**: branch, `git rev-parse HEAD`, `git status --porcelain -uall`, and the true remote tip.
3. Restore the sandbox environment (all documented in `HANDOFF.md` §B — these are environment quirks, not repository defects):
   - re-add `origin` and git `user.name`/`user.email` (`.git/config` does not persist);
   - `chmod +x /home/user/bin/pnpm` and `export PATH="/home/user/bin:$PATH"` in **every** shell;
   - `cd /home/user/malek && pnpm install --frozen-lockfile`;
   - restore `skills/**/*.py` exec bits — they appear as 8 phantom `mode change 100755 => 100644` entries. **Do not commit them:**
     ```bash
     git diff --summary skills/ | awk '/100755 => 100644/ {print $NF}' | xargs -r chmod +x
     ```
   - `pnpm exec playwright install chromium --with-deps` if you need browser runs.
4. Establish your own baseline before editing: `pnpm typecheck`, `pnpm db0:gate`, `node scripts/db0/replay-migrations.mjs`. **Record the numbers you actually measure.**

## Hard rules

- **Trust repository evidence and git state over any claim in any prior conversation or summary.** If a document and the code disagree, the code wins — then fix the document.
- **Continue from the current state. Do not restart the reconstruction. Do not redo completed work.**
- **Do not create parallel versions.** One capability = one approved implementation. No `v2` / `new` / `final` / `backup` trees.
- Stay on `reconstruction/checkpoint-20260909`. **No new branch, no PR, no merge, no force-push.**
- **Never `reset`, `revert`, `stash`, discard, or overwrite existing work.** Preserve anything newer you find.
- **Preserve historical financial correctness**: OMR 3 decimals, maker/checker, idempotency, correct retries, company/property/owner/tenant isolation, RLS.
- **Never invent accounting rules.** If the lawful treatment is not established in `docs/source-of-truth/`, **fail closed and surface the gap** — never guess, never zero it, never present a partial figure as a complete total.
- **No rewriting of posted history.** Corrections are append-only or compensating entries.
- **Merged migrations are immutable.** Repair forward, copying still-needed SQL **verbatim by line range** — never retyped.
- **No production data fixes. No unauthorized production changes.**
- **Never weaken an assertion, add a production fallback to mask a bad fixture, or change auth/Web Locks by guessing, in order to reach green.**
- Fix the authoritative source; **never edit a report to hide a difference**.
- **No completion claim without evidence.** Always state precisely what is proven and what is not. Distinguish *proven in production* from *proven only locally / in replay* — local SQL runs with mocked auth and cannot prove PostgREST, JWT behaviour, or hosted concurrency.

## Validation and checkpoint discipline

After **every** significant stage:

```
execute → focused tests → actually-saved SQL → browser → diff review → commit → push → verify the LITERAL remote SHA
```

- Verify the pushed SHA from the server (`git ls-remote` and/or the GitHub API), not from local state.
- **Never leave a large batch of completed work uncommitted.**
- Keep `docs/execution/RECONSTRUCTION_INVENTORY.md` current (COMPLETED / IN PROGRESS / NEXT / BLOCKED / REMOVED / PRESERVED), in the same commit as the work it describes.
- Sandbox RAM is ~1.9 GB. Use `node rentrix-app/scripts/run-sharded-regression.mjs` for the full suite. **A SIGKILL/`signal=null` worker death is INFRA, not a test verdict** — re-run that spec in isolation before concluding anything.
- **Two-build trap:** `pnpm build` + preview proves the production shell (PWA/SW/offline); `VITE_E2E=true` build + preview proves the fixture-driven UI specs. Neither proves the other's specs. A login screen with disabled inputs means you ran a fixture spec against a production bundle — infrastructure signature, never a product verdict.
- Credentials (Supabase token, GitHub PAT) are **not** in the repository and prior ones are revoked. Use any credential you are given **in-process only**; never store, print, or write it to a file. If one is missing, state the blocker and request it — do not lose work.

## Current unresolved scope (full detail in `HANDOFF.md` §G)

- **G1 — Authenticated app-shell E2E: BLOCKED.** Every login-based spec is gated on `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD`, which are unavailable. No local browser test reaches the authenticated shell.
- **G2 — Intermittent bootstrap stall: root cause OPEN.** The async-auth-callback deadlock hypothesis is *structurally excluded* (both `onAuthStateChange` listeners contain zero `await`), and the `withCompanyResolutionTimeout` fail-closed mitigation is proven — but the cause is unproven. Blocked by G1.
- **G3 — Hosted concurrency / Web Locks: not exercised.**
- **G4 — Runtime behaviour of the 11 recently applied migrations under real traffic: not exercised.**
- **G5 — PARTIALLY CLOSED at `9fac02ac`; this is your highest-priority remaining work.** An audit of all 92 production `.rpc(` call sites against the live database found four financially significant RPCs granted to `authenticated` with **no UI at all**. One is now closed (`offset_owner_receivable_atomic` → `OwnerReceivableOffsetPanel`, proven in replay, not hosted). **Still backend-complete but UI-absent:** `recover_owner_receivable_atomic`, `s09_create_correction_draft`, `s09_apply_correction`. Build each the same way — read the deployed function body first, fail-closed parsers, no client-side money arithmetic, one canonical mount, real-SQL tests. Then: governed historical adoption/allocation; remaining S08/S09 sources, cache/rebuild, permissions, read limits, retries, reconciliations; document-surface re-verification after the latest migrations.
- **G6 — Possible missing UI** for backend-complete adoption/allocation. **Unconfirmed — verify a surface does not already exist before building one.**
- **G7 — Whether the historical SEC-003/SEC-004 leaks were ever exploited: unknowable** (no access logs). Do not claim they were not.

## Required execution order

1. **Step 0 — Restore and verify** the environment and baseline (above). Do not edit before `git status` is clean and the branch tip is confirmed.
2. **Step 1 — Highest priority: unblock G1 → G2.** Ask the user for `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` or a disposable QA target — this is a genuine external blocker, not a routine decision. If provided, run the authenticated specs and attempt a traced reproduction of the bootstrap stall, then fix the proven cause. If not provided, record the blocker explicitly and proceed to Step 2. **Do not guess at auth or Web Locks.**
3. **Step 2 — Resolve G6 by inspection first.** `grep` the owners/financials features for the adoption/allocation RPCs from `20260909000012` / `...018`. If a surface exists, mark it resolved with the file path as evidence. Only if genuinely absent, build **one** canonical surface, with a browser spec plus a **negative control** (break the disclosure, prove the spec fails, restore byte-for-byte).
4. **Step 3 — Close the rest of G5.** Start with the three UI-absent RPCs named above, following the `OwnerReceivableOffsetPanel` pattern in `9fac02ac` (`owner-receivable-offset-service.ts` + `owner-receivable-offset.pglite.test.ts` are the reference implementation). Then work the full chain: expense → source evidence → classification → allocation → offset → settlement → ledger → balance → historical cutoff → reports. Verify against the **deployed** function body, not documentation. Any gap → forward migration + focused SQL test.
5. **Step 4 — Re-verify parity and re-measure everything.** Re-run the normalised repo↔production function-hash comparison and the full validation matrix. **Never present `HANDOFF.md`'s recorded numbers as current results.**
6. **Step 5 — Checkpoint after each step** using the discipline above, then continue to the next area.

Work autonomously on routine repository decisions — do not ask permission for ordinary engineering choices, and do not stop at merely producing a plan or a report. Continue until the remaining scope is resolved or genuinely blocked, and say plainly which of the two you reached.

**Do not declare the reconstruction complete unless the evidence proves it.** At the handoff point it was explicitly **not** complete.
