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

# everything
maestro test mobile-qa/flows/
```

## Flows

| Flow | Verifies | Plan item |
|---|---|---|
| `auth-guard-offline.yaml` | Offline cold launch reaches the login screen instead of hanging on a blank view | 0.1 |
| `tab-refresh.yaml` | A classification on Deck is reflected on Collection without an app restart; Profile shows live stats | 0.2 |
| `undo-after-review-later.yaml` | The undo pill names the title that was just sent to Review Later, and undo restores that title | 0.5 |

## Notes

- **A no-op Maestro run costs ~24s** on this setup, so these belong in a nightly job, not per-push CI. Do not use wall-clock around Maestro calls to measure app performance — measure the API directly instead.
- Flows create their own `mqa*` accounts through the real signup UI; there is no auth-bypass flag. Clean these up periodically (spec 50 §5).
- Google Password Manager dialogs can interrupt input. Flows dismiss them with `optional: true` taps; add more if a new dialog appears.
- `undo-after-review-later.yaml` swipes **up** for Review Later because that is mobile's current mapping. Plan item 3.6 unifies this with web (↑ Watch Later, ↓ Review Later) — update the swipe direction then and keep the assertions unchanged.
