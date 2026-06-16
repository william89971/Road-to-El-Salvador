#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# gate.sh — the deterministic, unfoolable verification gate.
#
# It runs the build, the tests, and the linter. It exits 0 ONLY if all three
# pass. The DeepSeek loop calls this after every change; a model can talk itself
# into "done," but it cannot talk this script into exit 0. You can also run it
# by hand anytime:   bash loop/gate.sh
# ─────────────────────────────────────────────────────────────────────────────
set -o pipefail
cd "$(dirname "$0")/.." || exit 2   # run from project root

fail=0
log=/tmp/gate-$$.log

run() {
  local name="$1"; shift
  printf '── %-6s ' "$name"
  if "$@" > "$log" 2>&1; then
    echo "PASS"
  else
    echo "FAIL"
    echo "   ┌─ last lines of '$name' output ─"
    tail -15 "$log" | sed 's/^/   │ /'
    echo "   └────────────────────────────────"
    fail=1
  fi
}

run build npm run build
run tests npm test
run lint  npm run lint

rm -f "$log"
echo
if [ $fail -eq 0 ]; then
  echo "GATE: PASS ✅"
else
  echo "GATE: FAIL ❌"
fi
exit $fail
