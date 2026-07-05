# Rentrix Roadmap Navigation

This file is a lightweight navigation page only. It intentionally does not duplicate detailed phase status because status changes quickly.

## Where to look

- Current dynamic execution status and next work: `docs/ai/CURRENT_EXECUTION_CONTEXT.md`
- Ordered implementation roadmap and phase gates: `docs/RENTRIX_MASTER_PLAN.md`
- Product/business blueprint: `docs/FINAL_PRODUCT_BLUEPRINT.md`
- Runtime facts, gaps, and contradictions: `docs/RUNTIME_TRUTH_AND_GAPS.md`
- Root/runtime boundaries: `docs/ROOT_LAYOUT.md`

## Stable boundaries

- Active application: `rentrix-app/`
- Shared workspace libraries: `lib/`
- Canonical database assets: `supabase/`
- Rentrix remains single-office, Arabic-first/RTL, with English/LTR kept safe.
- Do not add SaaS multi-tenancy, organizations, memberships, subscriptions, or a general ledger.

Before implementing roadmap work, compare the current checkout against `docs/ai/CURRENT_EXECUTION_CONTEXT.md` and the relevant code/tests. Do not infer runtime behavior from historical reports or old pull requests.
