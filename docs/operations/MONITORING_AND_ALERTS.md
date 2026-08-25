# Monitoring and Alerts

> **Status:** PARTIAL — Phase 3 Operational Release Proof
> **Honest baseline:** before this document, there was no monitoring or
> alerting tooling anywhere in this repository (verified by grep across
> source, workflows, and package manifests on 2026-08-25 — zero references
> to Sentry, Datadog, Logflare, PagerDuty, Opsgenie, or any uptime/health
> service).

## What exists today (platform-native, no setup required)

- **Supabase Advisors** (`get_advisors`, security + performance) — already
  usable ad hoc via the MCP connector; surfaced two real findings during
  this Phase 3 pass (leaked-password protection disabled;
  ~140 `SECURITY DEFINER` functions flagged, mostly expected for this
  RPC-heavy architecture but worth a periodic re-check for genuinely new
  ones).
- **Supabase unified logs** (`query_logs`) — queryable read-only, last 24h
  window, across `postgres_logs` / `edge_logs` / `function_edge_logs`.
- **Vercel deployment status** — build/runtime errors are visible per
  deployment in the Vercel dashboard; `Vercel:get_runtime_errors` and
  `Vercel:get_runtime_logs` tools exist and are usable by an agent with
  Vercel project access.
- **GitHub Actions CI** — `ci.yml`, `database-governance.yml`,
  `browser-readiness.yml`, `release-blocker-gate.yml`,
  `canonical-business-rules-guard.yml` already run on every PR to `main`,
  which is a form of continuous verification, though not runtime
  monitoring of the live system.

## What is genuinely missing (not invented, not minimized)

1. **No alerting/paging.** A production incident today would only be
   noticed if a human happened to check logs, advisors, or heard from a
   user. There is no threshold-based or anomaly-based alert of any kind.
2. **No uptime/synthetic monitoring.** Nothing periodically checks that
   `/login` or any critical route actually responds.
3. **No error-tracking SDK** (e.g., Sentry) capturing client-side or
   server-side exceptions in real time with stack traces and user context.
4. **No dashboard/visualization layer** over the Supabase logs or advisor
   data — each check is a manual, ad hoc query.

## What Phase 3 adds now (executable today, zero new paid services)

A scheduled GitHub Actions workflow that performs the same read-only
health checks demonstrated manually during this session — Supabase
advisors + a lightweight RPC/auth smoke check — and fails (which shows as
a red check in GitHub, visible in the Actions tab and optionally wired to
GitHub's own notification settings) if something regresses. This is a
genuine, if minimal, first monitoring layer: it costs nothing beyond CI
minutes and does not require a new vendor account, matching the
pre-production stage of this system.

See `.github/workflows/scheduled-health-check.yml` (added alongside this
document).

## What remains a genuine external decision, not an engineering gap

- **Choosing and paying for a real alerting/paging vendor** (PagerDuty,
  Opsgenie, or even a Slack/email webhook) is a product-owner decision
  with a real recurring cost or new account, appropriately out of scope
  for an autonomous engineering pass to decide unilaterally.
- **Choosing an error-tracking SDK** (Sentry vs. alternatives) similarly
  involves a new third-party account and a data-handling decision (what
  gets sent to a third party) that should be a deliberate choice, not a
  default inserted silently.

**Recommendation for G13 sign-off:** the scheduled health-check workflow
below is sufficient for a pre-production/demo-scale system with no real
customer data. Before the one-office pilot (G12) goes live with real
tenant/financial data, the two items above should be actual (paid,
configured) services, not just "the capability exists in principle."
Flagged here explicitly as a pre-pilot requirement, not a pre-Phase-3
requirement.
