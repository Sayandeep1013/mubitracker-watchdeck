# Mobile QA Flows

Maestro flows that verify mobile behaviour on a real Android device.
Convention and rationale: [`../docs/spec/50-pipeline.md`](../docs/spec/50-pipeline.md) §4.

## Prerequisites

1. **Device connected and authorised** — `adb devices` must list one in state `device`.
2. **Metro running** — `pnpm --filter @mubitracker/mobile dev`
   Tunnel mode does **not** work on this network (`exp.direct` is unreachable). Use LAN, or USB:
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```
3. **Expo Go installed**, matching the project's SDK (currently **54**). A mismatch shows an "incompatible" screen naming both versions.
4. **Maestro** on PATH — `maestro --version` (2.6.1 known good). On Windows this may resolve only via PowerShell, not Git Bash.

## Running

```bash
maestro test mobile-qa/flows/auth-guard-offline.yaml
maestro test mobile-qa/flows/tab-refresh.yaml
maestro test mobile-qa/flows/undo-after-review-later.yaml
maestro test mobile-qa/flows/deck-gesture-map-and-buttons.yaml
maestro test mobile-qa/flows/toast-and-keyboard.yaml
maestro test mobile-qa/flows/friends-ui.yaml

# everything
maestro test mobile-qa/flows/
```

## Flows

| Flow | Verifies | Plan item | Status |
|---|---|---|---|
| `auth-guard-offline.yaml` | Offline cold launch reaches the login screen instead of hanging on a blank view | 0.1 | run and passing |
| `tab-refresh.yaml` | A classification on Deck is reflected on Collection without an app restart; Profile shows live stats | 0.2 | run and passing |
| `undo-after-review-later.yaml` | The undo pill names the title that was just sent to Review Later, and undo restores that title | 0.5 | run and passing pre-3.6; swipe direction updated for 3.6, **not re-run** |
| `deck-gesture-map-and-buttons.yaml` | All four swipe directions (←/→/↑/↓) match the canonical web gesture map; the fallback button row + Confirm reaches the same outcome with zero gestures | 3.2, 3.5, 3.6 | **written, never run** — see file header |
| `toast-and-keyboard.yaml` | Offline classify shows the "Saved offline" toast (not a silent failure); the review modal's Save button stays reachable above the keyboard | 3.3, 3.4 | **written, never run** — see file header |
| `friends-ui.yaml` | Friends tab reachable, first-run discoverability nudge + Copy handle, all four segmented tabs render their empty states, add-friend modal opens and searches, notifications modal opens empty | 4.2 | **written, never run** — single-device scope only, see file header for what it can't cover |

## Notes

- **A no-op Maestro run costs ~24s** on this setup, so these belong in a nightly job, not per-push CI. Do not use wall-clock around Maestro calls to measure app performance — measure the API directly instead.
- Flows create their own `mqa*` accounts through the real signup UI; there is no auth-bypass flag. Clean these up periodically (spec 50 §5).
- Google Password Manager dialogs can interrupt input. Flows dismiss them with `optional: true` taps; add more if a new dialog appears.
- **Three flows above are marked "written, never run."** They were authored during Stage 3/4 (`2026-08-13`) with no Android device connected all session, by reading the screens' exact `accessibilityLabel` strings and component logic rather than by driving the app. The very first run of each should be treated as validating the *flow's own Maestro syntax* as much as the app underneath it — don't report a failure as a confirmed regression until you've ruled out a typo in the flow itself. Once a flow passes once, remove this caveat from its README row and change its status to "run and passing." `friends-ui.yaml` additionally only covers what one signed-in device can reach alone — request/accept/block/unblock/Compare/Their Deck need a second identity (a second device, or simulating one via direct backend API calls) and are not in this stub at all.
- Stage 3.1 (theme tokens) and 3.7 (per-screen loading/empty/error states) have no dedicated flow — they're either purely visual (no reliable Maestro assertion beyond a screenshot) or already incidentally exercised by the flows above (an error state only reachable via a forced network failure, which `auth-guard-offline.yaml` and `toast-and-keyboard.yaml` partially cover). Do a manual pass over both once a device is available, screenshot each of the seven screens' three states, and note results directly in `docs/HANDOFF.md`'s Session Log rather than trying to force everything through Maestro.
