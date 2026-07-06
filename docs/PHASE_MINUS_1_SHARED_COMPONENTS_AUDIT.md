# Phase -1 Shared Components Audit

Date: 2026-07-05
Scope: read-only audit of the four feature-specific mobile cards that still wrap or replace `EntityCard`, plus the current form primitives. This report intentionally proposes a direction only; it does **not** merge, delete, or replace the existing components.

## Governance and production safety

- `docs/GOVERNANCE.md` was read before starting this audit.
- No production mutation was required or performed.
- This phase is UI/shared-component audit only; no Supabase schema or RPC change is proposed in this report.

## Baseline shared card capability

`EntityCard` already provides the shared mobile-card shell, keyboard activation for clickable cards, a configurable avatar icon, badge slot, generic metadata rows, stats slot, and action buttons. The core extension points relevant to this audit are:

- `badge?: ReactNode` for feature-specific status badges.
- `meta?: EntityCardMetaItem[]` for icon/value rows.
- `stats?: ReactNode` for custom lower content, including richer layouts.
- `actions?: EntityCardAction[]` for built-in card actions.
- `avatarIcon?: LucideIcon` and `className?: string` for icon and shell adjustments.

## Card audit findings

### 1. ContractCard

Current caller: `src/features/contracts/components/ContractCardList.tsx`.

Current custom behavior:

- Header with tenant name, location subtitle, and `StatusBadge` mapped from contract status.
- Lower row combines end date, an active-only days-remaining urgency pill, and monthly rent.
- Urgency border for active contracts with seven or fewer days remaining.
- Contract number as small supporting text under the lower row.
- Edit/delete actions are rendered outside the card by the caller.

Assessment:

- This is mostly presentational duplication of `EntityCard`'s shell, header, custom badge, stats, and supporting text slots.
- The only real extra data/display behavior is contract-specific urgency styling and the multi-item stats row. Both can be supplied through `EntityCard.stats` and `EntityCard.className` without changing `EntityCardProps`.
- Recommendation after approval: replace `ContractCard` usage with `EntityCard` in `ContractCardList`, then delete `contract-card.tsx` if no live imports remain.

### 2. PropertyCard

Current caller: `src/features/properties/properties-list-page.tsx`.

Current custom behavior:

- Large property icon and dotted status badge.
- Title and address layout differs from the standard `EntityCard` header.
- Unit-count summary helper distinguishes unknown count (`undefined`) from known zero.
- Optional occupancy progress bar and occupancy percentage.
- Optional monthly-rent display.

Assessment:

- The card shell, status badge slot, icon, title, address, and rent display are compatible with `EntityCard` today.
- The occupancy bar and unit-summary helper are real feature-specific display logic, but they can live in the caller and be passed through `EntityCard.stats`.
- `formatPropertyUnitSummary` is exported and has an existing test, so the helper should be preserved or moved to a small feature/helper file before deleting the card component.
- Recommendation after approval: keep the helper behavior, render the property mobile card through `EntityCard`, and either move `formatPropertyUnitSummary` to a non-card helper or keep a helper-only export until imports are migrated. Delete `property-card.tsx` only after its component and helper imports are gone.

### 3. UnitCard

Current callers: `src/features/units/units-list.tsx` and `src/features/units/units-page.tsx`.

Current custom behavior:

- Header with unit number, optional floor subtitle, and status badge.
- Lower row with optional notes and formatted rent.
- No unique behavior beyond standard card shell plus a simple stats row.

Assessment:

- This is presentational duplication and is directly replaceable with `EntityCard` using `avatarIcon={DoorOpen}`, a custom `StatusBadge`, subtitle for floor, and `stats` for notes/rent.
- Recommendation after approval: replace both unit call sites with `EntityCard`, then delete `unit-card.tsx` if `rg` confirms no imports remain.

### 4. ReceiptCard

Current caller: `src/features/financials/receipts/receipts-page.tsx`.

Current custom behavior:

- Header with receipt number, payment date subtitle, printer icon, and a hard-coded posted badge.
- Lower row with payment method, receipt context, shortened invoice id, and amount.
- The `status` prop is accepted but not used; the visible badge always says posted.
- View/print/void actions are rendered outside the card by the caller.

Assessment:

- The shell, icon, title, subtitle, custom badge, and lower details are compatible with `EntityCard` today.
- The unused `status` prop is a finding: migration should either map status to the badge honestly or remove the prop at the call site if the receipts list is intentionally posted-only.
- Recommendation after approval: replace `ReceiptCard` with `EntityCard` in the receipts page, resolve the status-display ambiguity explicitly, and delete `receipt-card.tsx` if no imports remain.

## Form primitive audit findings

Current primitives:

- `FormSection` provides section title/description and `space-y-4` content spacing.
- `ResponsiveFormOverlay` chooses a mobile bottom sheet and desktop dialog using the `(max-width: 767px)` media query.
- `FormActions` is only a single submit button wrapper, with no shared cancel slot, sticky/mobile action region, or shared error layout.

Assessment:

- There is no single unified form system yet. The current pieces solve separate concerns: grouping, responsive surface, and a minimal submit action.
- A unified component can be introduced without deleting the existing primitives immediately by composing them first, then migrating feature forms incrementally after approval.

Recommended design for approval:

- Add a new `EntityForm` family under `src/components/ui/` with a single exported API that composes:
  - `EntityForm.Root` / `EntityForm` for the `<form>` element and standard spacing.
  - `EntityForm.Section` compatible with `FormSection` title/description spacing.
  - `EntityForm.ErrorSummary` for consistent top-level errors.
  - `EntityForm.Actions` for submit/cancel buttons, disabled/loading state, and mobile-friendly full-width or sticky action behavior.
  - `EntityForm.Overlay` or a companion `EntityFormOverlay` that wraps `ResponsiveFormOverlay` for bottom-sheet/dialog consistency.
- Keep tokens aligned with existing classes (`rounded-2xl`, `gap-4`, `space-y-4`, `min-h-11`, `text-sm`, `text-xs text-muted-foreground`) rather than introducing new color or typography tokens.
- After approval, migrate the four card consumers and introduce the form primitive in the same Phase -1 implementation PR, then delete dead custom card components only when imports are gone.

## Approval gate

Before implementation, Muhammad should explicitly approve or reject these recommendations:

1. Replace `ContractCard`, `UnitCard`, and `ReceiptCard` with `EntityCard` using current props plus caller-provided `stats`/`badge`.
2. Replace `PropertyCard` with `EntityCard`, while preserving/moving `formatPropertyUnitSummary` and its test coverage.
3. Resolve receipt status display by either mapping `status` into the badge or documenting that the receipts list is posted-only.
4. Add the `EntityForm` primitive family and migrate form usage only after the card consolidation direction is accepted.
