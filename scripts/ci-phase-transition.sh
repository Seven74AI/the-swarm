#!/bin/bash
# Full CI pipeline for the-swarm
set -euo pipefail
cd /root/.hermes/kanban/boards/the-swarm/workspaces/t_1d43a5fe

echo "=== CI: THE SWARM Phase Transition ==="
echo ""

# Layer 1: Unit tests
echo "--- Vitest ---"
npx vitest run 2>&1 | tail -10
VITEST_EXIT=${PIPESTATUS[0]}
echo "Vitest exit: $VITEST_EXIT"

# Layer 2: Type checking
echo ""
echo "--- TypeScript ---"
npx tsc --noEmit 2>&1 | tail -5
TSC_EXIT=${PIPESTATUS[0]}
echo "tsc exit: $TSC_EXIT"

# Layer 3: Playwright E2E (just the new transition test)
echo ""
echo "--- Playwright (phase-transition) ---"
npx playwright test tests/e2e/phase-transition.spec.ts --workers=1 --reporter=line 2>&1 | tail -10
PW_EXIT=${PIPESTATUS[0]}
echo "Playwright exit: $PW_EXIT"

echo ""
echo "=== RESULTS ==="
echo "vitest:     $([ $VITEST_EXIT -eq 0 ] && echo PASS || echo FAIL)"
echo "tsc:        $([ $TSC_EXIT -eq 0 ] && echo PASS || echo FAIL)"
echo "playwright: $([ $PW_EXIT -eq 0 ] && echo PASS || echo FAIL)"

[ $VITEST_EXIT -eq 0 ] && [ $TSC_EXIT -eq 0 ] && [ $PW_EXIT -eq 0 ]
