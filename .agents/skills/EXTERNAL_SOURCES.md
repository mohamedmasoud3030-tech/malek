# Vendored skill source revisions

External skills were originally copied on 2026-07-07 from the following upstream revisions:

- anthropics/skills: 9d2f1ae187231d8199c64b5b762e1bdf2244733d
- mattpocock/skills: 8515a080a74dbcf5019a1a78efc24b5fcafb36b8
- obra/superpowers: d884ae04edebef577e82ff7c4e143debd0bbec99

On 2026-07-08 the set was pruned to 10 total skills (see `README.md`). Only one externally-sourced skill remains vendored:

- `superpowers-systematic-debugging` (from obra/superpowers)

All `anthropics/skills` and `mattpocock/skills` copies were removed as part of the prune since none of the remaining 10 skills originate from those sources. The `EXTERNAL_LICENSES/LICENSE-superpowers` file is kept to cover the remaining superpowers-sourced skill; `LICENSE-mattpocock-skills` was removed.

The remaining ECC-origin skills (`react-patterns`, `postgres-patterns`, `security-review`, `error-handling`, `vite-patterns`) are not tracked against a specific upstream commit here — see each `SKILL.md` front-matter for `metadata.origin`.
