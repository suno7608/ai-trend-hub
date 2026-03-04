#!/usr/bin/env bash

set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="${PYTHON_BIN:-python3}"
FAIL_COUNT=0

run_step() {
  local title="$1"
  shift

  echo ""
  echo "============================================================"
  echo "[TEST] ${title}"
  echo "------------------------------------------------------------"
  echo "$*"

  if "$@"; then
    echo "[PASS] ${title}"
  else
    echo "[FAIL] ${title}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

cd "${ROOT_DIR}" || exit 1

echo "AI Commerce Daily newsletter test runner"
echo "Root: ${ROOT_DIR}"
echo "Python: ${PYTHON_BIN}"
echo "Mode: dry-run only (no actual Gmail send)"

run_step \
  "Python syntax check" \
  "${PYTHON_BIN}" -m py_compile \
  tools/get_subscribers.py tools/send_newsletter.py scripts/newsletter_sender.py

run_step \
  "Load subscribers (placeholder-safe check)" \
  "${PYTHON_BIN}" tools/get_subscribers.py --verbose

run_step \
  "Generate HTML + send_newsletter dry-run" \
  "${PYTHON_BIN}" tools/send_newsletter.py --to suno7608@gmail.com

run_step \
  "Orchestrator dry-run (force mode, manual recipient)" \
  "${PYTHON_BIN}" scripts/newsletter_sender.py --force --recipient suno7608@gmail.com

run_step \
  "Orchestrator schedule gate check (non-force)" \
  "${PYTHON_BIN}" scripts/newsletter_sender.py --recipient suno7608@gmail.com

echo ""
echo "============================================================"
if [ "${FAIL_COUNT}" -eq 0 ]; then
  echo "ALL TESTS PASSED"
  exit 0
fi

echo "TESTS FAILED: ${FAIL_COUNT}"
exit 1
