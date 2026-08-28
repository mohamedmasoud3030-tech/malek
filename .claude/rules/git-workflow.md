# Git and parallel-session workflow

These rules apply to all Claude Code sessions in this repository.

- Treat one Claude Web session as one task branch and one focused PR.
- Start from the latest intended base; normally `origin/main` unless the task explicitly depends on another branch.
- Never push directly to `main`.
- Never merge a PR unless the user explicitly requests the merge.
- Do not reuse, reset, rebase, delete, or repurpose another active task branch.
- Before broad or cross-cutting edits, inspect open/current work for overlap when GitHub access is available.
- Parallel work is safe only when task boundaries are genuinely independent. If another active branch touches the same subsystem or files, preserve both bodies of work and resolve the overlap deliberately.
- If `main` advances during a task, compare the new base before finalizing. Integrate only when necessary; never discard other work to make the branch look clean.
- Keep commits focused. Do not mix cleanup unrelated to the requested task.
- Never commit secrets, `.env` contents, provider credentials, browser traces, generated build output, dependency caches, or temporary debugging artifacts.
- A PR description must distinguish checks actually run from checks not run, and repository evidence from runtime/live evidence.
