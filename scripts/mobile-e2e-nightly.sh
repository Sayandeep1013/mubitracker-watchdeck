#!/usr/bin/env bash
# Runs inside the booted emulator step of .github/workflows/nightly.yml's
# mobile-e2e job. Deliberately one script file invoked as a single `run:`
# line — android-emulator-runner's multi-line `script:` field executes
# each line as its own independent subshell, so a variable set on one
# line (e.g. APK_URL=...) is empty by the next line. Discovered by an
# actual failed run (31764945548), not guessed.
#
# Every long-running step below has an explicit timeout and a progress
# echo. A real dispatch (31765393373) hung completely silently for 45+
# minutes somewhere after emulator boot with zero log output — with no
# per-step timeout, this job just hung until manually cancelled instead
# of failing fast with a diagnosable log. The job-level `timeout-minutes`
# in nightly.yml is the backstop if a step's own timeout still isn't
# enough.
set -euo pipefail

echo "Resolving Expo Go APK URL..."
APK_URL=$(node scripts/resolve-expo-go-apk.mjs)
echo "Expo Go APK: $APK_URL"

echo "Downloading Expo Go APK..."
curl -fsSL --max-time 180 "$APK_URL" -o expo-go.apk
ls -la expo-go.apk

echo "Installing Expo Go on the emulator..."
timeout 120 adb install -r expo-go.apk
echo "Expo Go installed."

pnpm --filter @mubitracker/mobile dev --non-interactive &
METRO_PID=$!
trap 'kill $METRO_PID 2>/dev/null || true' EXIT

echo "Waiting for Metro..."
METRO_READY=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8081/status > /dev/null 2>&1; then
    METRO_READY=1
    break
  fi
  sleep 2
done
if [ "$METRO_READY" -ne 1 ]; then
  echo "Metro never became ready after 60s — failing fast instead of continuing into flows that would hang."
  exit 1
fi
echo "Metro is ready."

adb reverse tcp:8081 tcp:8081
echo "Running Maestro flows..."
timeout 600 maestro test mobile-qa/flows/
