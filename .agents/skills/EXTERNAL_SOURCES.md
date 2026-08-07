# Vendored skill source revisions

External skills were originally copied on 2026-07-07 from these upstream revisions:

- anthropics/skills: 9d2f1ae187231d8199c64b5b762e1bdf2244733d
- mattpocock/skills: 8515a080a74dbcf5019a1a78efc24b5fcafb36b8
- obra/superpowers: d884ae04edebef577e82ff7c4e143debd0bbec99

The current vendored set is maintained based on the MALEK codebase and the three canonical source-of-truth documents, not on removed status/TODO/archive files.

Only one externally sourced skill remains from the upstream repos above:

- `superpowers-systematic-debugging` (from obra/superpowers)

All `anthropics/skills` and `mattpocock/skills` copies remain removed. The `EXTERNAL_LICENSES/LICENSE-superpowers` file is retained for the remaining superpowers-sourced skill.

The ECC-origin skills (`react-patterns`, `react-testing`, `postgres-patterns`, `database-migrations`, `security-review`, `error-handling`, `vite-patterns`, `browser-qa`, `design-system`, `frontend-a11y`) are not tracked against a specific upstream commit here; see each `SKILL.md` front matter for `metadata.origin`.
