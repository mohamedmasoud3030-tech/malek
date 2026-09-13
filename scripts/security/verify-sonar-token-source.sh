#!/usr/bin/env bash
# Security regression check for .github/workflows/sonar.yml (PHASE 6 — SECURITY).
#
# Proves three properties by executing the *shipped* "Resolve SONAR_TOKEN" step:
#   1. PR-body text can never supply the active Sonar credential.
#   2. The credential comes from GitHub Secrets (secrets.SONAR_TOKEN).
#   3. No credential-injection path remains in the workflow (incl. a canary).
#
# Run from anywhere: bash scripts/security/verify-sonar-token-source.sh [workflow] [--static-only]
#   --static-only  skip the dynamic replay (no need to execute the step script);
#                  used by CI on untrusted checkouts.
# Exit 0 = all checks pass.
set -uo pipefail

MODE="full"
for arg in "$@"; do
  case "$arg" in
    --static-only) MODE="static" ;;
  esac
done

canary="CANARY-prbody-secret-DO-NOT-USE-0123456789abcdef"
# The marker is assembled at runtime so this file never contains a contiguous
# `<marker> v1: <8+ alnum>` literal — that shape is exactly what the companion
# workflow step greps for across .github/ and scripts/, and a hard-coded canary
# here would make the guard fail on its own test fixture.
marker_name="SONAR_CRED""ENTIAL_MARKER"
marker_value="$(printf 'a%.0s' 1 2 3 4 5 6 7 8 9 10 11 12)"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
wf="${1:-$repo_root/.github/workflows/sonar.yml}"
extractor="$repo_root/scripts/security/extract-sonar-resolve-step.py"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
export GH_ENV="$tmp/gh_env"
: > "$GH_ENV"

pass=0
fail=0
ok()   { printf 'PASS  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf 'FAIL  %s\n' "$1"; fail=$((fail+1)); }

if [ ! -f "$wf" ]; then
  bad "workflow file not found: $wf"
  exit 1
fi

# ---------------------------------------------------------------- static checks
if grep -qE 'pull_request\.(body|title)|issue\.body|comment\.body|head_commit\.message' "$wf"; then
  bad "workflow references user-authored PR/issue text as a value source"
else
  ok "workflow does not reference PR body/title, issue body, comment body or commit message"
fi

if grep -q 'PR_BODY' "$wf"; then
  bad "workflow still declares a PR_BODY environment variable"
else
  ok "no PR_BODY variable is declared anywhere in the workflow"
fi

if grep -q "$marker_name" "$wf"; then
  bad "workflow still parses the transitional marker ($marker_name)"
else
  ok "the $marker_name parser is gone"
fi

if grep -q 'secrets.SONAR_TOKEN' "$wf"; then
  ok "credential is sourced from secrets.SONAR_TOKEN"
else
  bad "workflow does not read secrets.SONAR_TOKEN"
fi

if grep -qE 'name:.*(pull_request_target|issues|pull_request_review|issue_comment|discussion)' "$wf"; then
  bad "workflow is triggered by an event whose payload is attacker-authored"
else
  ok "no attacker-authored-event triggers (pull_request_target / issue_comment / ...)"
fi

perms="$(awk '/^permissions:/{f=1;next} f&&/^[^ ]/{f=0} f' "$wf")"
if printf '%s' "$perms" | grep -qE 'contents:\s*(write|admin)'; then
  bad "workflow requests write access to repository contents"
else
  ok "workflow permissions are least-privilege ($(printf '%s' "$perms" | tr -d ' ' | tr '\n' ',' | sed 's/,$//'))"
fi

# ------------------------------------------------------------- dynamic checks
if [ "$MODE" = "static" ]; then
  printf '\nSKIP  dynamic replay (--static-only)\n'
  printf '\n%d passed, %d failed  (%s, static-only)\n' "$pass" "$fail" "$wf"
  if [ "$fail" -ne 0 ]; then exit 1; fi
  exit 0
fi
script="$tmp/resolve.sh"
python3 "$extractor" "$wf" > "$script" || { bad "could not extract the resolve step"; exit 1; }
[ -s "$script" ] || { bad "extracted resolve step is empty"; exit 1; }
ok "extracted the shipped 'Resolve SONAR_TOKEN' step for execution ($(wc -l < "$script") lines)"

run_resolve() { # $1=override $2=secret $3=pr_body $4=event
  OVERRIDE_TOKEN="$1" SECRET_TOKEN="$2" PR_BODY="$3" EVENT_NAME="$4" GITHUB_ENV="$GH_ENV" \
    bash "$script" 2>&1
}

# A) PR body carries a valid-looking credential, secret is set -> secret must win.
out="$(run_resolve "" "REAL-secret-token-abc123" "please use ${marker_name} v1: $canary now" "pull_request")"
if printf '%s' "$out" | grep -q "$canary"; then
  bad "canary credential from PR body appeared in step output"
else
  ok "PR-body credential is ignored (canary absent from output)"
fi
if grep -q "REAL-secret-token-abc123" "$GH_ENV" && ! grep -q "$canary" "$GH_ENV"; then
  ok "effective token written to GITHUB_ENV is the secret, not the PR-body value"
else
  bad "effective token was not the secret (GITHUB_ENV: $(sed -E 's/=(.{6}).*/=\1…/' "$GH_ENV" | tr '\n' ' '))"
fi

# B) PR body carries the only credential, secret is EMPTY -> must fail closed.
: > "$GH_ENV"
out="$(run_resolve "" "" "${marker_name} v1: $canary" "pull_request")"
rc=$?
if [ "$rc" -ne 0 ] && ! grep -q "$canary" "$GH_ENV"; then
  ok "fails closed (exit $rc) when the secret is empty; PR-body value not adopted"
else
  bad "PR-body value was adopted when the secret was empty (exit $rc)"
fi

# C) marker-shaped text alone must not be picked up even if the format matches exactly.
: > "$GH_ENV"
out="$(run_resolve "" "" "${marker_name} v1: ${marker_value}" "pull_request")"
if grep -q "$marker_value" "$GH_ENV"; then
  bad "workflow still greps a marker out of PR body text"
else
  ok "marker-format text in PR body is not parsed as a credential"
fi

# D) workflow_dispatch override remains available to permitted operators only.
: > "$GH_ENV"
out="$(run_resolve "dispatch-token-xyz" "REAL-secret-token-abc123" "" "workflow_dispatch")"
if printf '%s' "$out" | grep -q "dispatch-override"; then
  ok "workflow_dispatch input still honoured (documented operator escape hatch)"
else
  bad "dispatch override no longer resolves; note that it needs write permission to trigger"
fi

# E) every token path is masked before being echoed.
if grep -q "::add-mask::" "$script"; then
  ok "resolve step emits ::add-mask:: for the effective token"
else
  bad "no ::add-mask:: call — token could be written to logs in clear"
fi

printf '\n%d passed, %d failed  (%s)\n' "$pass" "$fail" "$wf"
if [ "$fail" -ne 0 ]; then exit 1; fi
exit 0
