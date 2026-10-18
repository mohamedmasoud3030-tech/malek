# Agent Handover — MALEK

> Supporting, point-in-time handover only. This document does not replace the [MALEK Canonical Pack](docs/source-of-truth/00_INDEX.md), change approved business rules, or grant governance-stage/release credit.

- **Recorded local date:** 2026-10-08 (`America/Los_Angeles`).
- **Source revision inspected and built:** `2d20a0d356204857b4acc1e393eaea107aa8e6a7`.
- **Working branch:** `arena/35340dd0-malek`; PR target: `main`.
- **Change scope:** this handover, the complete Arabic inventory in Markdown and PDF, and its navigation index; no application, database, dependency-manifest, or lockfile changes.

## 1. Project structure summary

MALEK is an Arabic-first/RTL rental-property-management web application. There is one active application workspace, `malek-app/`; repository-level documentation, governance, database assets, and shared checks live alongside it.

```text
/
├── malek-app/                 Active React application workspace
│   ├── src/
│   │   ├── app/               Shell, navigation, router, and providers
│   │   ├── components/        Shared UI, layout, branding, and document components
│   │   ├── features/          Domain workspaces, services, hooks, and colocated tests
│   │   ├── hooks/             Shared authentication, company, and form hooks
│   │   ├── lib/               Supabase client, formatting, money, PWA, and export utilities
│   │   ├── routes/            Authentication, protected, public, and legal route components
│   │   ├── services/          Shared services and the document/print/PDF platform
│   │   ├── store/             UI state
│   │   ├── styles/            Design tokens and responsive/RTL styling
│   │   ├── test/              Fixtures and database/document contract tests
│   │   └── types/             Database and domain TypeScript contracts
│   ├── public/               Local fonts, brand assets, PWA manifest, and offline page
│   ├── e2e/                  Playwright browser, release, and supporting fixtures
│   └── scripts/              Architecture, frontend/database contract, and deployment checks
├── supabase/
│   ├── functions/            Deno Edge Functions: AI assistant and background worker
│   ├── migrations/           Executable schema history and per-table RLS templates
│   ├── config.toml           Local Supabase and function configuration
│   └── seed.sql              Deterministic reference/bootstrap data
├── scripts/                  Shared CI, DB0, database guardian, security, and QA tools
├── docs/                     Canonical pack, decisions, runbooks, reviews, and dated evidence
├── governance/               Locked rules, decisions, stage plan, and integrity hashes
├── skills/                   Agent-agnostic database, review, and architecture procedures
├── .claude/                  Claude discovery adapters, commands, rules, and vendored helpers
├── .github/                  Ownership, issue template, and GitHub Actions workflows
└── patches/                  Reviewed PDFKit patch used by the dependency graph
```

**Uploaded inventory documents:** [Arabic inventory index](docs/inventory/README.md), [complete Markdown report](docs/inventory/malek-files-ar.md), and [complete PDF report](docs/inventory/malek-files-ar.pdf). Both reports retain the original 1,755-file source snapshot; the index lists the four subsequently added handover/delivery files.

- **Main entry:** `malek-app/src/index.tsx` → `App.tsx` → `app/router/app-router.tsx` and `route-tree.ts`.
- **Domain coverage in source:** properties, units, owners, people/tenants, contracts, billing, collections, receipts, expenses, accounting, owner settlements, reports, maintenance, utilities, contextual documents, settings, permissions, support, AI, automation, and external portals. Lands, leads, communications, audit, and specialized tools also have repository surfaces. Presence is not a claim of completion or routine-UX visibility.
- **Database history:** 113 timestamped SQL migration files under `supabase/migrations/`; archived SQL evidence and RLS templates are separate from that executable count. Fresh replay and hosted migration parity were not tested in this task.
- **Start here before changes:** [AGENTS.md](AGENTS.md), [DATABASE_RULES.md](DATABASE_RULES.md), and [canonical documentation index](docs/source-of-truth/00_INDEX.md).

## 2. Build status

### Result: PASS — local production-mode bundle build

| Item                 | Observed result                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Command              | `corepack pnpm build` from the repository root                                             |
| Exit code            | `0`                                                                                        |
| First build error    | **None**                                                                                   |
| Build implementation | `node scripts/write-build-proof.mjs && vite build --config vite.config.ts` in `malek-app/` |
| Output               | `malek-app/dist/public/`, including `index.html`, assets, `sw.js`, and Workbox output      |
| Vite summary         | 3,665 modules transformed; `built in 36.43s`                                               |
| PWA summary          | `generateSW`; 28 precache entries, 428.16 KiB                                              |
| Local toolchain      | Node.js `22.22.3`; pinned pnpm `10.11.1`                                                   |
| CI toolchain         | `.github/workflows/ci.yml` selects Node.js `24`; this was not a CI run                     |

Reproduction sequence actually executed:

```bash
corepack pnpm --version # 10.11.1
corepack pnpm install --frozen-lockfile --ignore-scripts
corepack pnpm rebuild esbuild
corepack pnpm build
corepack pnpm typecheck
```

Dependency installation, the approved native-tool rebuild, the bundle build, and TypeScript checking all exited successfully. The frozen install did not change `pnpm-lock.yaml` or either package manifest.

### Non-blocking build warnings

1. **First warning: missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.** The local build guard permits this warning outside enforced/Vercel production. A successful local bundle does **not** prove a working backend or a deployable production configuration; real reviewed public Supabase configuration is required there. No credentials or replacement environment values were introduced.
2. Browserslist reported that its `caniuse-lite` data is six months old.
3. `auth-service.ts` has both static and dynamic imports, so the dynamic imports do not move it into a separate chunk.
4. The minified document-renderer chunk is approximately 1,264.51 kB, exceeding the configured 1,024 kB warning threshold.

These are warnings, not the first error; the build result remains **PASS**. No unrelated fixes, dependency updates, or bundle changes were attempted.

### Additional verification and boundaries

- `corepack pnpm typecheck`: **PASS**; no TypeScript error reported.
- `corepack pnpm check:docs`: **PASS** after adding the inventory documents and index.
- `git diff --cached --check -- AGENT_HANDOVER.md docs/inventory/README.md`: **PASS** for the edited handover and new index. The copied Arabic inventory is preserved byte-for-byte, including its intentional two-space Markdown hard line breaks.
- Full Vitest, financial, accessibility, Playwright, fresh-database, and hosted-QA suites: **not run** in this documentation task.
- Browser/runtime behavior, hosted Supabase/Auth/Storage, production deployment, and AI provider connectivity: **not verified**.
- Generated dependencies, logs, build proof, and bundle output are not included in the PR.
- Build success does not change the governed S01–S10 stage ledger or establish release readiness.

## 3. Tech stack detected

Versions below are resolved from the frozen install, rather than inferred from semver ranges alone. Runtime/deployment targets are identified from source and configuration, not from a live environment inspection.

| Layer                 | Detected technology                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace/toolchain   | pnpm `10.11.1` workspace; Node.js; ESM; TypeScript `5.9.3`                                                                                          |
| Frontend              | React / React DOM `19.1.0`                                                                                                                          |
| Build and development | Vite `7.3.2` with the React plugin; ES2022 build target                                                                                             |
| Styling               | Tailwind CSS `4.3.0`, PostCSS `8.5.13`, Autoprefixer `10.5.0`, CSS design tokens, local Arabic fonts                                                |
| Routing               | TanStack React Router `1.169.2`; explicitly defined route tree and lazy route components                                                            |
| Server data/cache     | TanStack React Query `5.90.21`                                                                                                                      |
| Client UI state       | Zustand `5.0.13`                                                                                                                                    |
| Forms and validation  | React Hook Form `7.71.2`, Zod `3.25.76`, Hook Form resolvers                                                                                        |
| Shared UI             | Radix Dialog `1.1.15` and other primitives, Lucide React `0.545.0`, Sonner `2.0.7`                                                                  |
| Charts                | Recharts `2.15.4`                                                                                                                                   |
| Backend access        | Supabase JS `2.105.1`; Auth, PostgREST/RPC, and Storage access in application services                                                              |
| Database              | PostgreSQL SQL migrations, RLS policies, grants, atomic financial RPCs, and canonical general-ledger structures; hosted server version not verified |
| Edge/backend runtime  | Supabase Deno Edge Functions using `Deno.serve`; Deno version not verified                                                                          |
| AI integration        | Server-side context/safety contracts and an OpenAI-compatible provider adapter; configured provider/runtime not verified                            |
| Documents             | `@react-pdf/renderer` `4.9.0`, HTML print output, contextual attachment storage, and CSV/XLSX exports                                               |
| PWA                   | `vite-plugin-pwa` `1.3.0`, `workbox-window` `7.4.1`, service-worker/offline/install/update handling                                                 |
| Tests                 | Vitest `3.2.7`, Testing Library React `16.3.2`, Playwright `1.61.1`, axe accessibility tooling, Node's built-in test runner                         |
| Local database proofs | `@electric-sql/pglite` `0.5.4`; Supabase CLI `2.105.0`; DB0 and guardian scripts                                                                    |
| Deployment and CI     | Vercel configuration, Replit configuration, GitHub Actions, and SonarCloud configuration                                                            |

Evidence: [root package manifest](package.json), [application package manifest](malek-app/package.json), [workspace catalog](pnpm-workspace.yaml), [lockfile](pnpm-lock.yaml), [Vite configuration](malek-app/vite.config.ts), application imports, SQL migrations, and Edge Function source.

## 4. Number of files and folders

### Counting scope

Count **Git-tracked project files** and every directory implied by their paths. Exclude `.git/` and untracked/ignored dependencies, build output, caches, logs, and other generated artifacts. Tracked generated contracts such as `malek-app/src/types/database.ts` and the versioned inventory deliverables remain included, along with hidden tracked files, environment templates, tests, documentation, fonts, images, and SQL evidence.

| Metric                                                             |     Count |
| ------------------------------------------------------------------ | --------: |
| Files at the inspected source revision, before this handover       | **1,755** |
| Repository files after adding the handover and inventory documents | **1,759** |
| Directories, excluding the repository root                         |   **204** |
| Directories, including the repository root                         |   **205** |
| Directory groups containing files directly, including root         |   **200** |
| Test/spec files in the inspected source                            |   **611** |

The complete Arabic inventory is preserved as a snapshot of the inspected source revision: **1,755 files**, **203 ancestor directories excluding root**, and **199 file-containing groups including root**. This PR adds four delivery/documentation files and one directory (`docs/inventory/`), producing the current totals below. The original reports are complete for their cited source snapshot, rather than silently being presented as a regenerated inventory of this later PR.

### File distribution after adding the handover and inventory documents

| Top-level location |     Files |
| ------------------ | --------: |
| Repository root    |        19 |
| `.claude/`         |        16 |
| `.github/`         |        16 |
| `docs/`            |       127 |
| `governance/`      |         7 |
| `malek-app/`       |     1,367 |
| `patches/`         |         1 |
| `scripts/`         |        71 |
| `skills/`          |         7 |
| `supabase/`        |       128 |
| **Total**          | **1,759** |

Reproduce the tracked-file/directory counts after all four delivery/documentation files are staged or committed:

```bash
python - <<'PY'
from pathlib import PurePosixPath
import subprocess

files = subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")[:-1]
folders = {
    parent.as_posix()
    for file in files
    for parent in PurePosixPath(file).parents
    if parent.as_posix() != "."
}
print("Tracked files:", len(files))
print("Folders excluding root:", len(folders))
print("Folders including root:", len(folders) + 1)
PY
```

## Handover boundaries

- This PR is documentation-only. Approved Rule IDs and Gap IDs are unchanged; no product/accounting/security behavior is redefined.
- No database migration was applied, no historical financial data was rewritten, and no hosted/production mutation was performed.
- Existing canonical documentation and governance ledgers remain authoritative; this snapshot should not be treated as proof that a module is complete.
- The next agent should re-run relevant checks on its own revision and verify approved QA configuration before drawing runtime or release conclusions.
