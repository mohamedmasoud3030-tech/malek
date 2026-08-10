#!/usr/bin/env bash
set -euo pipefail

if [[ "${QA_MUTATION_APPROVED:-}" != "1" ]]; then
  echo "Refusing QA lifecycle: set QA_MUTATION_APPROVED=1 for this disposable QA run." >&2
  exit 2
fi

if [[ "${QA_ENVIRONMENT_KIND:-}" != "qa" || "${E2E_ENVIRONMENT_KIND:-}" != "qa" ]]; then
  echo "Refusing QA lifecycle: QA_ENVIRONMENT_KIND and E2E_ENVIRONMENT_KIND must both be qa." >&2
  exit 2
fi

node scripts/agent-qa-preflight.mjs

E2E_SINGLE_OFFICE_ENABLED=1 \
pnpm --filter ./rentrix-app exec node scripts/single-office-isolated-smoke.mjs seed

E2E_SINGLE_OFFICE_ENABLED=1 \
pnpm --filter ./rentrix-app exec playwright test e2e/single-office-isolated.spec.ts \
  --config playwright.config.ts --project=chromium-desktop

pnpm --filter ./rentrix-app exec node scripts/single-office-isolated-smoke.mjs verify
