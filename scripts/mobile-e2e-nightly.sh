#!/usr/bin/env bash
# Runs inside the booted emulator step of .github/workflows/nightly.yml's
# mobile-e2e job. Deliberately one script file invoked as a single `run:`
# line — android-emulator-runner's multi-line `script:` field executes
# each line as its own independent subshell, so a variable set on one
# line (e.g. APK_URL=...) is empty by the next line. Discovered by an
# actual failed run (31764945548), not guessed.
set -euo pipefail

APK_URL=$(node scripts/resolve-expo-go-apk.mjs)
echo "Expo Go APK: $APK_URL"
curl -fsSL "$APK_URL" -o expo-go.apk
adb install -r expo-go.apk

pnpm --filter @mubitracker/mobile dev --non-interactive &
METRO_PID=$!
trap 'kill $METRO_PID 2>/dev/null || true' EXIT

# Metro's first bundle build is the slow part — poll instead of a fixed sleep.
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8081/status > /dev/null 2>&1; then
    break
  fi
  sleep 2
done
adb reverse tcp:8081 tcp:8081

maestro test mobile-qa/flows/
