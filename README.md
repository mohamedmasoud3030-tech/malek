# Rentrix

Rentrix is a rental-property management web application for properties, units, people, contracts, financial workflows, maintenance, reports, and settings.

## Application location

The active app lives in `rentrix-app/`.

## Basic commands

```bash
pnpm install --frozen-lockfile
pnpm --filter ./rentrix-app dev
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter ./rentrix-app test
pnpm --filter ./rentrix-app run test:financials
```

## Documentation

See [`docs/`](docs) for product, architecture, domain, testing, current-state, and release-readiness notes. Start with [`AGENTS.md`](AGENTS.md) if you are a new contributor or agent.

Key operational documents:

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — current repository snapshot.
- [`docs/NEXT.md`](docs/NEXT.md) — prioritized remaining work.
- [`docs/RELEASE_READINESS.md`](docs/RELEASE_READINESS.md) — objective release gates and recommendation.
- [`docs/ENGINEERING_GOVERNANCE.md`](docs/ENGINEERING_GOVERNANCE.md) — mandatory engineering and migration policy.
- [`docs/GOVERNANCE.md`](docs/GOVERNANCE.md) — production mutation authorization.

## Contributing

Keep changes focused, run the relevant checks, and avoid committing generated build output or secrets.

## Financial reporting source of truth

Receipts in the current application are payment-backed: the Receipts UI reads `public.payments`, and reporting totals should use posted, non-deleted payments as the collection source. VOID payments may be displayed as receipt history, but they must not be included in collection, cash-flow, or payment-total reports.
