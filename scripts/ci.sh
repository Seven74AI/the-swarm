#!/bin/bash
# CI script for the-swarm prestige feature
set -euo pipefail
WORKSPACE="${1:-${PWD}}"
cd "$WORKSPACE"
echo "=== CI START (workspace: $WORKSPACE) ==="
echo ""

# Layer 1: Unit tests
echo "--- vitest ---"
npx vitest run 2>&1 | tail -5
VITEST_EXIT=${PIPESTATUS[0]}
echo "vitest exit: $VITEST_EXIT"

# Layer 2: Type checking
echo ""
echo "--- tsc ---"
npx tsc --noEmit 2>&1 | tail -5
TSC_EXIT=${PIPESTATUS[0]}
echo "tsc exit: $TSC_EXIT"

# Layer 3: E2E tests (start dev server, run tests, kill server)
echo ""
echo "--- playwright ---"
npx vite --port 5173 &
DEV_PID=$!
sleep 3
npx playwright test --workers=1 2>&1 | tail -10
PW_EXIT=${PIPESTATUS[0]}
kill $DEV_PID 2>/dev/null || true
echo "playwright exit: $PW_EXIT"

echo ""
echo "=== RESULTS ==="
echo "vitest:     $([ $VITEST_EXIT -eq 0 ] && echo PASS || echo FAIL)"
echo "tsc:        $([ $TSC_EXIT -eq 0 ] && echo PASS || echo FAIL)"
echo "playwright: $([ $PW_EXIT -eq 0 ] && echo PASS || echo FAIL)"

# Exit non-zero if anything failed
[ $VITEST_EXIT -eq 0 ] && [ $TSC_EXIT -eq 0 ] && [ $PW_EXIT -eq 0 ]
