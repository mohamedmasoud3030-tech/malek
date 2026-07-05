# Rentrix Claude Code Entry Point

Claude Code starts here, then follows the shared Rentrix rules in `docs/ai/AGENT_OPERATING_PROTOCOL.md` and Claude-specific notes in `docs/ai/CLAUDE_AGENT_GUIDE.md`.

Before any non-trivial edit:

- Confirm the active application is `rentrix-app/`.
- Read `docs/ai/CURRENT_EXECUTION_CONTEXT.md` for current dynamic status.
- Follow `docs/ai/AGENT_OPERATING_PROTOCOL.md` for product, architecture, domain, security, and verification boundaries.
- Do not expand scope or change Supabase, production configuration, credentials, migrations, RLS, RPCs, auth, or environment behavior without explicit approval.
- Use `rg` and `rg --files` for inspection.
- Review the diff and run the relevant verification before claiming completion.
