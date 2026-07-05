#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

failures=0
pass() { printf 'PASS: %s\n' "$1"; }
fail() { printf 'FAIL: %s\n' "$1"; failures=$((failures + 1)); }

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
    fail "entry file missing: $file"
    continue
  fi
  grep -q 'docs/ai/AGENT_OPERATING_PROTOCOL.md' "$file" && pass "$file references agent protocol" || fail "$file must reference docs/ai/AGENT_OPERATING_PROTOCOL.md"
  grep -q 'docs/ai/CURRENT_EXECUTION_CONTEXT.md' "$file" && pass "$file references current execution context" || fail "$file must reference docs/ai/CURRENT_EXECUTION_CONTEXT.md"
done

runtime_paths=(rentrix-app/src lib)
runtime_existing=()
for path in "${runtime_paths[@]}"; do
  [[ -d "$path" ]] && runtime_existing+=("$path")
done

if ((${#runtime_existing[@]})); then
  if rg -n "from ['\"]react-router-dom['\"]|require\(['\"]react-router-dom['\"]\)" "${runtime_existing[@]}"; then
    fail "runtime imports react-router-dom"
  else
    pass "runtime does not import react-router-dom"
  fi

  if rg -n "from ['\"][^'\"]*AppContext[^'\"]*['\"]|export .*AppContext|createContext<.*AppContext|const AppContext" "${runtime_existing[@]}"; then
    fail "runtime reintroduces AppContext"
  else
    pass "runtime does not reintroduce AppContext"
  fi

  if rg -n "from ['\"][^'\"]*useApp[^'\"]*['\"]|export .*useApp|function useApp|const useApp" "${runtime_existing[@]}"; then
    fail "runtime reintroduces useApp"
  else
    pass "runtime does not reintroduce useApp"
  fi

  if rg -n "from ['\"][^'\"]*dataService[^'\"]*['\"]|export .*dataService|const dataService|function dataService" "${runtime_existing[@]}"; then
    fail "runtime reintroduces dataService"
  else
    pass "runtime does not reintroduce dataService"
  fi

  if rg -n "from ['\"][^'\"]*(\.agents|\.agent-skills|\.codex/vendor)/|require\(['\"][^'\"]*(\.agents|\.agent-skills|\.codex/vendor)/" "${runtime_existing[@]}"; then
    fail "runtime imports agent-tooling paths"
  else
    pass "runtime does not import agent-tooling paths"
  fi
else
  fail "no runtime source paths found"
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

doc_fail=0
for file in "${active_docs[@]}"; do
  [[ -f "$file" ]] || { fail "active governance doc missing: $file"; continue; }
  if rg -n "artifacts/rentrix/(src|package\.json|vite\.config|run|test|build|dev)" "$file"; then
    doc_fail=1
  fi
done
if ((doc_fail)); then
  fail "active governance docs point to artifacts/rentrix as active app/runtime"
else
  pass "active governance docs do not point to artifacts/rentrix as active app/runtime"
fi

if ((failures)); then
  printf 'FAIL: AI governance validation found %d issue(s).\n' "$failures"
  exit 1
fi
printf 'PASS: AI governance validation complete.\n'
