#!/usr/bin/env bash
# Fails CI if docs/GOVERNANCE.md is missing, or if its "one rule" section
# has been removed/gutted. Exists so deleting the production-mutation
# safety rule (as happened to the old runbook in PR #1040) shows up as a
# CI failure, not a quiet diff in a "docs cleanup" PR.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GOV_FILE="$REPO_ROOT/docs/GOVERNANCE.md"
LOG_FILE="$REPO_ROOT/docs/GOVERNANCE_LOG.md"

fail() {
  echo "::error::$1"
  exit 1
}

[ -f "$GOV_FILE" ] || fail "docs/GOVERNANCE.md is missing. This file carries the production-mutation sign-off rule. Do not delete it in a docs cleanup — see its own header for why."

[ -f "$LOG_FILE" ] || fail "docs/GOVERNANCE_LOG.md is missing. It's the sign-off trail docs/GOVERNANCE.md requires."

grep -q "No AI agent (Claude, Codex, or any other) applies a mutation to the live" "$GOV_FILE" \
  || fail "docs/GOVERNANCE.md exists but its core rule sentence is gone or reworded. If the rule genuinely no longer applies, that's a product-owner decision, not a cleanup edit — restore the sentence or get explicit sign-off before changing it."

grep -q "^## Sign-off trail" "$GOV_FILE" \
  || fail "docs/GOVERNANCE.md is missing its 'Sign-off trail' section."

echo "Governance guard OK: docs/GOVERNANCE.md and docs/GOVERNANCE_LOG.md present, core rule intact."
