#!/bin/bash
set -e
cd /root/.hermes/kanban/boards/the-swarm/workspaces/t_8228590c

echo "=== PHASE 1: TypeScript Check ==="
npx tsc --noEmit 2>&1 | tee /tmp/tsc-output.txt
TSC_EXIT=${PIPESTATUS[0]}
echo "TSC_EXIT=$TSC_EXIT"

echo "=== PHASE 2: Unit Tests (Vitest) ==="
npx vitest run --reporter=verbose 2>&1 | tee /tmp/vitest-output.txt
VITEST_EXIT=${PIPESTATUS[0]}
echo "VITEST_EXIT=$VITEST_EXIT"

# Count passing/failing from vitest output
PASSED=$(grep -c " ✓ " /tmp/vitest-output.txt 2>/dev/null || echo 0)
FAILED=$(grep -c " × " /tmp/vitest-output.txt 2>/dev/null || echo 0)
echo "VITEST_PASSED=$PASSED"
echo "VITEST_FAILED=$FAILED"

echo "=== PHASE 3: E2E Tests (Playwright) ==="
npx playwright test --workers=1 2>&1 | tee /tmp/playwright-output.txt
PW_EXIT=${PIPESTATUS[0]}
echo "PW_EXIT=$PW_EXIT"

# Count E2E results
PW_PASSED=$(grep -c " passed " /tmp/playwright-output.txt 2>/dev/null || echo 0)
PW_FAILED=$(grep -c " failed " /tmp/playwright-output.txt 2>/dev/null || echo 0)
echo "PW_PASSED=$PW_PASSED"
echo "PW_FAILED=$PW_FAILED"

echo "=== SUMMARY ==="
echo "TSC_EXIT=$TSC_EXIT"
echo "VITEST_EXIT=$VITEST_EXIT VITEST_PASSED=$PASSED VITEST_FAILED=$FAILED"
echo "PW_EXIT=$PW_EXIT PW_PASSED=$PW_PASSED PW_FAILED=$PW_FAILED"

# Overall exit: 0 if all pass
if [ "$TSC_EXIT" = "0" ] && [ "$VITEST_EXIT" = "0" ] && [ "$PW_EXIT" = "0" ]; then
  echo "ALL_PASS=true"
  exit 0
else
  echo "ALL_PASS=false"
  exit 1
fi
