# Third-party Claude Code material

The following files are vendored from Anthropic's official `anthropics/claude-plugins-official` repository so Claude Code Web sessions can use them without depending on runtime plugin installation.

They are distributed under the Apache License 2.0. A copy of the license is included at `.claude/skills/frontend-design/LICENSE.txt`.

## Vendored files

| Local file | Upstream path | Upstream blob SHA |
| --- | --- | --- |
| `.claude/agents/code-explorer.md` | `plugins/feature-dev/agents/code-explorer.md` | `e0f667ef65f7204399110214defd46ce062a1a51` |
| `.claude/agents/code-architect.md` | `plugins/feature-dev/agents/code-architect.md` | `fcb78bfd11004048fa287ac52c55eb5c17855549` |
| `.claude/agents/code-reviewer.md` | `plugins/feature-dev/agents/code-reviewer.md` | `7fb589cbd7140152fae41720e391290ba202e57e` |
| `.claude/skills/frontend-design/SKILL.md` | `plugins/frontend-design/skills/frontend-design/SKILL.md` | `decdff43d05908b4c1fc2cfd2d80fc5743440934` |

Upstream repository: `https://github.com/anthropics/claude-plugins-official`

The MALEK-specific files (`CLAUDE.md`, `.claude/commands/*`, `.claude/rules/*`, and `.claude/README.md`) are project-local configuration and are not copies of the upstream material.

When updating a vendored file, compare its new upstream blob SHA and preserve the applicable license/attribution. If a vendored file is modified locally, mark that modification clearly rather than presenting it as an unchanged upstream copy.
