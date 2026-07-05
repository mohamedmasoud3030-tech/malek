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

## Contributing

Keep changes focused, run the relevant checks, and avoid committing generated build output or secrets.
