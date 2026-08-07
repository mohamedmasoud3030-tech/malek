# MALEK — Brand & Design (Canonical)

> **Source-of-truth document.** Consolidates ADR 0011 (brand identity), ADR 0012 (design-system refresh roadmap), ADR 0013 (Wave 1 rollout), ADR 0014 (Wave 2 finance reporting), `docs/brand/MALEK_ASSET_CONTRACT.md`, `docs/ui-ux/MALEK_VISUAL_CONTRACT_V2.md` (+ token proposal), Wave-3/Wave-4A inventories, and the legacy `RENTRIX_VISUAL_DIRECTION.md` (superseded for future work but historically retained). The visible-name split MALIK vs MALEK is **Conflict C-01** — recorded, not resolved here.

---

## 1. Current locked identity (governing)

Per **ADR 0011 (Accepted 2026-08-04)** and the **MALEK asset contract**:

| Item | Canonical value |
|---|---|
| Visible English name | **MALEK** |
| Arabic name | **مالك** |
| Arabic tagline | **كل أملاكك في مكان واحد** ("All your properties in one place") |
| Angular M mark | `/malek-mark.svg` |
| Full lockup (incl. MALEK word) | `/malek-lockup.svg` |
| PWA maskable icon | `/malek-maskable.svg` |
| Login lockup | `/malek-lockup.svg` |
| Expanded navigation | shared brand component: `/malek-mark.svg` + `APP_BRAND_NAME` |
| Collapsed navigation | `/malek-mark.svg` |
| PWA icon | `/malek-lockup.svg` |

Identity rules:
- Text/image lockup only — there is **no** drawn property/building icon; never invent one.
- All visible surfaces must consume canonical assets or shared brand components; legacy marks/images with the old visible spelling are **not valid runtime assets**.
- Brand-contract tests (`rentrix-app/src/lib/brand-contract.test.ts`) fail CI on reintroduction of the old identity or on referencing unreferenced legacy icons.

**Compatibility boundary (locked):** repository name, historical migrations, persisted storage keys, package paths, database objects, and other non-visible technical contracts may keep legacy spellings (`malik` repo, `rentrix-app` dir, rentrix DB objects) until a separately planned migration. This exception **never** permits the old spelling in user-facing UI.

## 2. Naming chronology (why docs disagree — C-01)

1. **Rentrix era**: original product/name; persists in `rentrix-app/` paths, DB objects, root docs' technical text.
2. **MALIK era**: commercial rename; root `README.md`, `AGENTS.md`, `TESTING.md`, `AUDIT_INVENTORY.md`, `FINAL_DELIVERY.md` and `malik-mark.svg` belong to this period.
3. **MALEK era (current, locked)**: ADR 0011 corrected the visible English spelling to MALEK; verified in code — `index.html` title "MALEK", PWA manifest "MALEK", canonical assets `malek-mark/lockup/maskable.svg` exist (`src` counts: 165 `malek` vs 76 `malik` references, the latter mostly technical identifiers). Residue: `malik-mark.svg` still in `public/` (unreferenced residue), plus stale MALIK-era docs (D-2 in Deletion Proposal).

**Owner confirmation needed** (Open Decisions): blessing the reconciliation — docs updated to MALEK while technical identifiers stay frozen.

## 3. Design system refresh roadmap (ADR 0012, Accepted 2026-08-05)

Locked rules (verbatim summary):
1. Accessible Minimalism = global visual foundation.
2. Bento Box Grid = responsive composition for summaries/KPIs/quick actions/modular dashboard surfaces.
3. Enterprise SaaS (Mobile) style #83 = mobile interaction reference only.
4. Executive Dashboard = home Dashboard hierarchy model.
5. Financial Dashboard + Drill-Down Analytics = finance/reporting surfaces only.
6. Cairo remains the font. 7. MALEK blue semantic identity remains (refinable, not replaceable). 8. Indigo/Violet gradient + Plus Jakarta Sans **explicitly excluded**. 9. React web PWA (no native-only APIs). 10. Light default; dark via `data-theme`. 11. RTL first-class. 12. ADR 0011/asset contract lock stands. 13. Third-party mockups are not acceptance sources. 14. **No big-bang redesign.** 15. Dashboard = first isolated proof.

Scoped proof: `[data-visual-contract='v2']` wraps only the Dashboard subtree; scoped tokens, **not** `:root`; promotion after Phase-2 approval. Phases 0–6 defined in the ADR (documentation → dashboard proof → promotion).

## 4. Rollout log (what actually shipped)

| Wave | ADR/PR | Content | State |
|---|---|---|---|
| Wave 1 | ADR 0013, PR #1357 | Visual Contract V2 rollout wave 1 (dashboard proof groundwork) | merged |
| Wave 2 | ADR 0014, PR #1358 | Finance hubs + reporting surfaces under V2; post-merge review documented | merged |
| Operational redesign | PR #1359 | operational pages redesign | merged |
| Wave 3 | PR #1368 | Enterprise design-system foundation: tokens (`styles/tokens.css`) + `components/ui/*` primitives; inventory doc | merged |
| Wave 4A | PR #1369 | Enterprise UX composition layer (`components/enterprise/`), additive-only | merged (base `8e4908a7`) |
| Dashboard V2 | PR #1352 | dashboard proof under `[data-visual-contract='v2']` | merged |

## 5. Token mandate

- All product UI consumes semantic tokens (`--color-primary`, `--color-success-*`, `--color-warning-*`, `--color-danger-*`, `--color-info-*`, `--color-neutral-*`, surfaces, text hierarchy, borders, focus ring) with complete light+dark pairs per the V2 contract; numeric targets in `MALEK_VISUAL_CONTRACT_V2_TOKEN_PROPOSAL.md`.
- **Raw Tailwind palette utilities banned** in product UI; **emerald/success reserved for success-only** semantics.
- Cairo via Google Fonts — external dependency flagged in operational items (self-host consideration is an open question, see Open Decisions).

## 6. Legacy visual direction (historical, superseded)

`docs/ui-ux/RENTRIX_VISUAL_DIRECTION.md` v2.0 (Enterprise Minimalism / Swiss clarity / financial discipline / soft layering / mobile-first; rejected glassmorphism) — **superseded for future work by Visual Contract V2** (its principles are largely compatible and absorbed). Retained as historical reference; do not cite it as governing.

## 7. Asset inventory status

- Canonical: `malek-mark.svg`, `malek-lockup.svg`, `malek-maskable.svg` (referenced, tested).
- Residue: `malik-mark.svg` (unreferenced), `icon-rentrix-192.png`, `icon-rentrix-512.png` (unreferenced, retained for git-history/bundle-budget reasons; safe to delete upon approved MALEK icon set — see Deletion Proposal D-2).
- Deletion is **not** performed by this consolidation; proposals only.
