# 0014 — R11 Legacy Feature Disposition (Roadmap V2)

- Status: DECIDED (repository disposition register)
- Date: 2026-08-16
- Stage: Roadmap V2 / R11
- Rule: each feature receives exactly one of KEEP / MERGE INTO PARENT DOMAIN /
  HIDE-FREEZE / REMOVE. There is no "keep provisionally and keep refactoring it".

## Register

| Feature | Decision | Rationale (repository evidence) |
| --- | --- | --- |
| Commissions | **KEEP** | Financially integrated: `pay_commission_atomic` + direct-write hardening migrations (20260801000002, 20260804020000); standalone `/commissions` route with `commissions.view`; consumed by finance workflow groups. Removing or freezing it would orphan a hardened financial authority. |
| Automation | **KEEP** | Server-controlled execution (`run_scheduled_automation_rules`) with company-isolation hardening (20260730090500, 20260807232244); creation feeds maintenance via the canonical RPC path. |
| Lands | **HIDE/FREEZE** | Read/registry feature with no financial or accounting integration. Stays behind `lands.view` for roles that already have it; FROZEN: no new development, no refactor investment; disposition to MERGE (into properties) or REMOVE is a later product decision once usage data exists. |
| Leads | **HIDE/FREEZE** | CRM-light registry, no financial coupling. Same freeze contract as Lands (candidate parent domain: people/party). |
| Communication | **HIDE/FREEZE** | Operational log, no financial coupling. Same freeze contract (candidate parent domain: party contact timeline). |
| Legacy routes | **KEEP (as redirects only)** | Retired deep links (`?section=commissions`, `/finance/banking`) remain ONLY as redirects resolved by the R9 shell model; no legacy route may mount a workspace directly. |
| Compatibility aliases | **REMOVE (progressively, already started)** | R2 removed the settlement aliases (`tax_amount→utility_deductions`, fabricated fee rate/type). Remaining owner `name`/`full_name` duplication is neutralized by the sync trigger (R7) and scheduled for physical removal with the governed Party merge. `settings.manage` (marked «توافق قديم») is retired when the settings IA consolidates on `company.settings.manage`. |

## Freeze contract (Lands / Leads / Communication)

1. No new capabilities, screens, or schema for a frozen feature.
2. Bug fixes only when the defect leaks into a non-frozen domain
   (e.g. a broken shared component).
3. The permission catalog entries stay (removing them would silently change
   role surfaces — an R5 matrix change must be explicit).
4. A frozen feature may not gain new cross-feature dependency edges — the
   architecture guard allowlist for these features must not grow.

## Enforcement

`rentrix-app/src/features/system/r11-legacy-disposition.test.ts` pins:
- the disposition register exists and covers every named feature;
- frozen features keep their current dependency edges (no growth);
- retired legacy deep links stay redirect-only in the shell model.
