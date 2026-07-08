# Vendored skill source revisions

External skills were originally copied on 2026-07-07 from the following upstream revisions:

- anthropics/skills: 9d2f1ae187231d8199c64b5b762e1bdf2244733d
- mattpocock/skills: 8515a080a74dbcf5019a1a78efc24b5fcafb36b8
- obra/superpowers: d884ae04edebef577e82ff7c4e143debd0bbec99

On 2026-07-08 the set was pruned from 21 to 10, then grown back to 15 after mapping candidates against active work in `docs/NEXT.md`, `docs/FEATURE_GAP_REGISTER.md`, and `docs/ui/UX_NAVIGATION_AND_RESPONSIVE_AUDIT.md` (see `README.md` for the current index and rationale).

Only one externally-sourced skill is vendored from the three upstream repos above:

- `superpowers-systematic-debugging` (from obra/superpowers)

All `anthropics/skills` and `mattpocock/skills` copies remain removed — none of the 15 current skills originate from those two sources. The `EXTERNAL_LICENSES/LICENSE-superpowers` file is kept to cover the remaining superpowers-sourced skill; `LICENSE-mattpocock-skills` stays removed.

The remaining ECC-origin skills (`react-patterns`, `react-testing`, `postgres-patterns`, `database-migrations`, `security-review`, `error-handling`, `vite-patterns`, `browser-qa`, `design-system`, `frontend-a11y`) are not tracked against a specific upstream commit here — see each `SKILL.md` front-matter for `metadata.origin`.
