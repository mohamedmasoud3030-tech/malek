# Rentrix GitHub Copilot Instructions

- The active application is `rentrix-app/`.
- Before non-trivial edits, read `docs/ai/CURRENT_EXECUTION_CONTEXT.md` and follow `docs/ai/AGENT_OPERATING_PROTOCOL.md`.
- Keep Rentrix single-office, Arabic-first with safe English/LTR behavior.
- Do not add SaaS multi-tenancy, organizations, memberships, subscriptions, a general ledger, standalone payments, receipts without posted payments, direct posted-payment edits, or a second outstanding-balance path.
- Do not reintroduce `react-router-dom`, `useApp`, `AppContext`, or `dataService` into runtime.
- Do not expand scope or change Supabase, production configuration, migrations, RLS, RPCs, auth, environment variables, secrets, or credentials without explicit approval.
- Use `rg` and `rg --files` for repository inspection.
- Review the final diff and run relevant verification before stating work is complete.
