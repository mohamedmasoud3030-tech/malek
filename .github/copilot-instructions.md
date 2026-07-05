# Rentrix GitHub Copilot Instructions

- The active application currently lives in `rentrix-app/`.
- For non-trivial edits, review `docs/ai/CURRENT_EXECUTION_CONTEXT.md` and `docs/ai/AGENT_OPERATING_PROTOCOL.md`.
- Use current code, tests, migrations, and CI configuration as runtime evidence.
- Use `rg` and `rg --files` for repository inspection when available.
- Treat legacy patterns or agent-tooling imports as review signals: explain intent, impact, and verification if they appear.
- Review the final diff, run appropriate checks, and document risks and impact before stating work is complete.
