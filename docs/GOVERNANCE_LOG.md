# Governance Log

Append-only. One line per production mutation, added when it's applied —
not before, not as a batch cleanup later. See `docs/GOVERNANCE.md` for the
rule this log exists to satisfy.

Format: `YYYY-MM-DD | approved by | what was applied | PR/commit`

2026-07-06 | Mohamed (product owner) | Created this log and docs/GOVERNANCE.md; no production mutation performed by this entry itself | PR TBD (docs/add-governance-guardrails branch)
2026-07-06 | Mohamed (product owner) | Phase 0 audit finding F0-6: repointed custom_access_token_hook to read role from public.users.role instead of public.profiles.role, closing the drift where profiles.role could never be MANAGER. Verified no-op for all existing ADMIN users before and after. Applied via Supabase MCP apply_migration, live migration version 20260706014138. | PR #1052
2026-07-06 | Mohamed (product owner) | Applied previously-committed-but-unapplied migration 20260705000004_fix_sessions_rls_user_id.sql to production: sessions_select_own, sessions_insert_own, sessions_delete_own now compare auth.uid() to sessions.user_id instead of sessions.id (the row primary key), restoring correct self-ownership for non-admin/manager users. Verified live policy definitions post-apply. | PR TBD (fix/sessions-rls-apply-to-production branch)
