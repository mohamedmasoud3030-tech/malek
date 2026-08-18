# MALEK — AI Decisions Log

> Non-canonical working decisions for this agent session. Does not override Canonical Pack or governance ledgers.

## Decision policy used

1. Prefer canonical rules and locked D01–D18 over local taste.
2. Prefer smallest reversible fix inside existing architecture.
3. Do not grant governed stage credit.
4. Do not invent legal/tax/accounting policy.
5. Ask owner only for credentials, paid services, production mutation, or market/pricing/legal commitments.

## D-AI-001 — Assessment baseline

- **Decision:** Treat current Git `6500ff5` + Canonical Pack + live local inspection as baseline; historical audits are supporting evidence only.
- **Why:** Document baselines can lag `main`; collapsing truths caused past false “complete/missing” claims.
- **Reversible:** yes.

## D-AI-002 — First execution milestone: install/PWA + public SEO hygiene

- **Decision:** First safe autonomous milestone is **PWA raster install icons + absolute robots sitemap**, not financial kernel work and not Master Lease expansion.
- **Why:**
  - Financial GAP-006..016 engineering is largely repository-complete; remaining blockers are hosted/pilot/sign-off (external).
  - Confirmed user-facing defect: iOS/Android install used SVG-only icons (`apple-touch-icon` → SVG), which Safari does not install cleanly.
  - Confirmed crawl defect: `robots.txt` pointed to relative `Sitemap: /sitemap.xml`.
  - Both are reversible, require no credentials, no schema change, no business-policy invention.
- **Rejected alternatives:**
  - Start Master Lease UI (large scope, GAP-012, professional accounting labeling risk).
  - Attempt live RLS/Auth verification (blocked without credentials).
  - Enable SonarCloud on every PR (may cost/break CI; needs owner).
  - Rewrite CSP nonce pipeline (hosting-aware; higher risk/low immediate user value).
- **Reversible:** yes (restore previous manifest/index/robots).

## D-AI-003 — Raster icons derived from canonical SVG mark

- **Decision:** Generate `malek-icon-{192,512}.png`, `malek-maskable-{192,512}.png`, and `malek-apple-touch-180.png` from approved `/malek-mark.svg` and `/malek-maskable.svg`; keep SVGs in manifest for capable clients.
- **Why:** Brand contract forbids wiring legacy `icon-malik-*` / `icon-rentrix-*` PNGs; new rasters must carry current MALEK geometry.
- **Evidence:** visual inspection of generated 512px assets; brand contract tests updated and passing.
- **Reversible:** yes.

## D-AI-004 — Keep legacy PNG filenames untouched

- **Decision:** Leave `icon-malik-*`, `icon-maskable-*`, `icon-rentrix-*` on disk as unused legacy artifacts (already listed in `LEGACY_UNUSED_BRAND_ASSETS`).
- **Why:** Deleting them is cleanup with no user value this turn; brand tests already ban runtime references.
- **Reversible:** n/a.

## D-AI-005 — pnpm onlyBuiltDependencies for esbuild/core-js/supabase

- **Decision:** Add `pnpm.onlyBuiltDependencies` so sandbox installs can run required native postinstall scripts.
- **Why:** Fresh environment blocked Vite without esbuild binary; this is operational reliability, not product behavior.
- **Reversible:** yes.

## D-AI-006 — Do not start S09 / historical correction

- **Decision:** No historical backfill or S09 activation work.
- **Why:** Canonical REL-004 / GAP-015/016 require genuine accounting S08 approval first.
- **Reversible:** n/a (non-action).

## D-AI-007 — Communication language

- **Decision:** Owner chat in simple Arabic; durable code/docs/identifiers in English (except existing Arabic UI copy).
- **Why:** Owner profile request.

## D-AI-008 — Placeholder Supabase config is a first-visit hard stop

- **Decision:** `getEnvDiagnostics()` treats missing **and** placeholder/CI public Supabase values as not configured, using `env.isConfigured` as the shared authority with the client boundary.
- **Why:** Login previously only detected empty env vars. CI/local placeholder values (`example.supabase.co` / `test-anon-key`) still enabled the form and produced opaque network failures.
- **User copy:** Arabic, non-technical, no secret/host leakage.
- **Evidence:** `runtime-diagnostics.test.ts` 3/3 PASS; login + related suites still PASS.
- **Reversible:** yes.

## D-AI-009 — Local secret handling for owner-provided Supabase access

- **Decision:** Store only public Vite values in gitignored `rentrix-app/.env.local`. Store service-role / management token / QA passwords only in gitignored root `.env.qa` with mode `600`. Never commit, never put service-role under `VITE_*`, never echo secrets into docs or commits.
- **Why:** Owner provided live project credentials to unblock hosted verification.
- **Observed blocker:** this sandbox currently cannot complete TLS handshakes to the public internet (`SSL_ERROR_SYSCALL`), so agent-side Auth/REST/Supabase CLI calls fail even with valid credentials. The user Live Preview browser can still call Supabase from the user network.
- **Security note for owner:** credentials were pasted in chat; if the chat/logs are shared, rotate the DB password, service-role key, and personal access token after this session.
- **Reversible:** delete the two local env files.

## Open decisions requiring owner (not taken)

| Topic | Why blocked |
|---|---|
| Confirm login on Live Preview | Sandbox outbound HTTPS blocked; needs user browser check or network egress fix |
| SonarCloud always-on CI | May consume paid plan / fail PRs |
| Paid monitoring provider | Cost + retention policy |
| Oman legal registration profile content | Legal counsel |
| Statutory tax code catalog confirmation | Tax professional |
| Production deploy / DNS / pilot office | Business authority |
| Rotate exposed secrets if chat is non-private | Security hygiene after paste-in-chat |
