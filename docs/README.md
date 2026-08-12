# Mubitracker Docs

## Start here — in this order

| # | Doc | What it answers |
|---|---|---|
| 1 | [`CONTEXT.md`](CONTEXT.md) | What is this, where does it run, what state is it in? |
| 2 | [`HANDOFF.md`](HANDOFF.md) | What happened last session, what's next, what's the prompt? |
| 3 | [`IMPLEMENTATION-PLAN.md`](IMPLEMENTATION-PLAN.md) | Exactly what to build, in order, and how to verify it. |

Those three are enough to resume work cold. Everything else is reference.

## Reference

| Doc | Purpose |
|---|---|
| [`AUDIT-2026-08-12.md`](AUDIT-2026-08-12.md) | Evidence base — every known bug, with severity and file:line |
| [`spec/README.md`](spec/README.md) | Spec index + hierarchy. Which spec supersedes which. |
| [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) | ⚠️ **Legacy, stale.** Superseded by `CONTEXT.md`. Kept for history. |
| [`TASKLIST.md`](TASKLIST.md) | ⚠️ **Legacy, stale.** Superseded by `IMPLEMENTATION-PLAN.md`. |

The two legacy files contain claims that are no longer true (11 specs / 2 migrations / "no git repo" / "Expo SDK 52 scaffolded"). Refreshing them is Stage 5.7 in the plan; until then, trust `CONTEXT.md`.

## Keeping docs honest

`HANDOFF.md` defines the protocol: tick the plan checkbox, log the change, update `CONTEXT.md` if state changed, rewrite the next-session prompt if priorities moved. A checkbox is ticked only when its acceptance criterion is **verified** — not when the code compiles.
