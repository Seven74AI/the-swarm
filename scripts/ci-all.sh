#!/bin/bash
set -euo pipefail
cd /root/.hermes/kanban/boards/the-swarm/workspaces/t_d33adad7

REPORT="/tmp/ci-report-gm5.json"
PASSED=0
FAILED=0

echo "=== CI: ALL ==="

# 1. TypeScript type checking
echo "--- tsc --noEmit ---"
if npx tsc --noEmit 2>&1 | tee /tmp/tsc-output.txt; then
  echo "tsc: PASS"
  TSC_PASS=true
else
  echo "tsc: FAIL"
  TSC_PASS=false
fi

# 2. Vitest unit tests
echo "--- vitest run ---"
if npx vitest run --reporter=verbose 2>&1 | tee /tmp/vitest-output.txt; then
  VITEST_PASS=true
  TESTS_PASSED=$(grep -oP 'Tests\s+\K\d+(?=\s+passed)' /tmp/vitest-output.txt | tail -1 || echo "?")
  TESTS_FAILED=$(grep -oP 'Tests\s+.*?\K\d+(?=\s+failed)' /tmp/vitest-output.txt | tail -1 || echo "0")
  echo "vitest: PASS ($TESTS_PASSED passed, $TESTS_FAILED failed)"
else
  VITEST_PASS=false
  TESTS_PASSED=$(grep -oP 'Tests\s+\K\d+(?=\s+passed)' /tmp/vitest-output.txt | tail -1 || echo "?")
  TESTS_FAILED=$(grep -oP 'Tests\s+.*?\K\d+(?=\s+failed)' /tmp/vitest-output.txt | tail -1 || echo "?")
  echo "vitest: FAIL"
fi

# 3. Playwright E2E tests
echo "--- playwright test ---"
if npx playwright test --workers=1 2>&1 | tee /tmp/playwright-output.txt; then
  PW_PASS=true
  PW_PASSED=$(grep -oP '^\s*\d+\s+passed' /tmp/playwright-output.txt | grep -oP '\d+' || echo "?")
  echo "playwright: PASS ($PW_PASSED passed)"
else
  PW_PASS=false
  PW_PASSED=$(grep -oP '^\s*\d+\s+passed' /tmp/playwright-output.txt | grep -oP '\d+' || echo "?")
  echo "playwright: FAIL"
fi

# Summary
echo ""
echo "=== CI SUMMARY ==="
echo "tsc:     $TSC_PASS"
echo "vitest:  $VITEST_PASS ($TESTS_PASSED passed, $TESTS_FAILED failed)"
echo "playwright: $PW_PASS ($PW_PASSED passed)"

# Write JSON report
cat > "$REPORT" << JSONEOF
{
  "tsc": "$TSC_PASS",
  "vitest": "$VITEST_PASS",
  "vitest_passed": "$TESTS_PASSED",
  "vitest_failed": "$TESTS_FAILED",
  "playwright": "$PW_PASS",
  "playwright_passed": "$PW_PASSED",
  "all_pass": $([ "$TSC_PASS" = "true" ] && [ "$VITEST_PASS" = "true" ] && [ "$PW_PASS" = "true" ] && echo true || echo false)
}
JSONEOF

echo "Report: $REPORT"
cat "$REPORT"
