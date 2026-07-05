#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

passes=0
warnings=0
pass() { printf 'PASS: %s\n' "$1"; passes=$((passes + 1)); }
warn() { printf 'WARN: %s\n' "$1"; warnings=$((warnings + 1)); }

printf 'Rentrix AI governance advisory check\n'
printf 'Repository: %s\n\n' "$ROOT_DIR"

if ! command -v rg >/dev/null 2>&1; then
  warn "ripgrep (rg) is unavailable; search-based advisory checks were skipped"
  printf '\nSummary: %d PASS, %d WARN\n' "$passes" "$warnings"
  exit 0
fi

ENTRY_FILES=(
  "AGENTS.md"
  "CLAUDE.md"
  ".github/copilot-instructions.md"
  ".cursor/rules/00-rentrix-core.mdc"
)

for file in "${ENTRY_FILES[@]}"; do
  if [[ -f "$file" ]]; then
    pass "entry file exists: $file"
  else
    warn "entry file is missing: $file"
    continue
  fi
  grep -q 'docs/ai/AGENT_OPERATING_PROTOCOL.md' "$file" \
    && pass "$file references agent protocol" \
    || warn "$file does not reference docs/ai/AGENT_OPERATING_PROTOCOL.md"
  grep -q 'docs/ai/CURRENT_EXECUTION_CONTEXT.md' "$file" \
    && pass "$file references current execution context" \
    || warn "$file does not reference docs/ai/CURRENT_EXECUTION_CONTEXT.md"
done

runtime_paths=(rentrix-app/src lib)
runtime_existing=()
for path in "${runtime_paths[@]}"; do
  [[ -d "$path" ]] && runtime_existing+=("$path")
done

if ((${#runtime_existing[@]})); then
  pass "runtime source paths found: ${runtime_existing[*]}"

  if rg -n "from ['\"]react-router-dom['\"]|require\(['\"]react-router-dom['\"]\)" "${runtime_existing[@]}"; then
    warn "runtime references react-router-dom; review intent, migration impact, and test coverage"
  else
    pass "no runtime react-router-dom imports detected"
  fi

  if rg -n "from ['\"][^'\"]*AppContext[^'\"]*['\"]|export .*AppContext|createContext<.*AppContext|const AppContext" "${runtime_existing[@]}"; then
    warn "runtime references AppContext; review whether this is legacy, reference, or intentional architecture"
  else
    pass "no runtime AppContext references detected"
  fi

  if rg -n "from ['\"][^'\"]*useApp[^'\"]*['\"]|export .*useApp|function useApp|const useApp" "${runtime_existing[@]}"; then
    warn "runtime references useApp; review whether this is legacy, reference, or intentional architecture"
  else
    pass "no runtime useApp references detected"
  fi

  if rg -n "from ['\"][^'\"]*dataService[^'\"]*['\"]|export .*dataService|const dataService|function dataService" "${runtime_existing[@]}"; then
    warn "runtime references dataService; review whether this is legacy, reference, or intentional architecture"
  else
    pass "no runtime dataService references detected"
  fi

  if rg -n "from ['\"][^'\"]*(\.agents|\.agent-skills|\.codex/vendor)/|require\(['\"][^'\"]*(\.agents|\.agent-skills|\.codex/vendor)/" "${runtime_existing[@]}"; then
    warn "runtime imports agent-tooling paths; review bundling impact and intent"
  else
    pass "no runtime agent-tooling imports detected"
  fi
else
  warn "no runtime source paths found for advisory scan"
fi

active_docs=(
  "AGENTS.md"
  "README.md"
  "docs/ROOT_LAYOUT.md"
  "docs/INDEX.md"
  "docs/ROADMAP.md"
  "docs/ai/AGENT_OPERATING_PROTOCOL.md"
  "docs/ai/ONBOARDING.md"
  "docs/ai/AGENT_CAPABILITIES.md"
  "docs/ai/engineering-policy.md"
  "docs/ai/release-policy.md"
  "docs/ai/testing-guide.md"
  "docs/decisions/README.md"
  ".ai/workflows/README.md"
)

doc_warnings=0
for file in "${active_docs[@]}"; do
  if [[ ! -f "$file" ]]; then
    warn "active governance doc not found: $file"
    continue
  fi
  if rg -n "artifacts/rentrix/(src|package\.json|vite\.config|run|test|build|dev)" "$file"; then
    doc_warnings=$((doc_warnings + 1))
  fi
done
if ((doc_warnings)); then
  warn "active governance docs contain artifacts/rentrix runtime references; review whether each is historical or intentional"
else
  pass "no active governance docs point to artifacts/rentrix as an active runtime path"
fi

printf '\nSummary: %d PASS, %d WARN\n' "$passes" "$warnings"
printf 'AI governance advisory check completed without blocking CI.\n'
exit 0
