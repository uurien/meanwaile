# Agents — Meanwaile

## What this app does

Meanwaile is a macOS menu-bar app (Electron) that detects when your AI coding agent is working and you're idle — and offers you a minigame in a small popup until the agent needs you again.

No notifications. No integrations. One trick, done well.

The game popup appears when, and only when, both signals hold simultaneously:

1. **The agent is working** — between `UserPromptSubmit` and `Stop`, with no pending `Notification` (`permission_prompt` / `idle_prompt`). If the agent is waiting on the user, that's terminal time, not game time.
2. **No user activity for the configured idle threshold** — keyboard/mouse idle time via `powerMonitor.getSystemIdleTime()`, user-configurable (default 15–30 s range, tuned in phase 0).

When both signals hold, the popup opens directly — no intermediate hint, no confirmation step. Dismissing costs nothing (Esc or switching apps).

When the agent finishes or needs the user, the game **pauses** and prompts: "looks like the task is done, you should get back to work" — with **Close** and **It can wait a bit more**. The user always has the final say.

On-demand mode: clicking the tray icon opens the game directly, anytime, bypassing all detection conditions.

## TDD — tests before code (mandatory)

Write tests first, implementation second. No exceptions.

1. Write the test file (or extend an existing one) describing the expected behavior.
2. Confirm the test fails for the right reason.
3. Write the minimum implementation to make it pass.
4. Refactor if needed, keeping tests green.

Test runner: **Vitest** (`npm test` / `npm run test:watch`). Test files live alongside source in `src/` or in `tests/`.

## Dev setup

```bash
npm install
npm run start        # build (tsc) + launch Electron
npm test             # run Vitest once
npm run test:watch   # Vitest in watch mode
```

Node >= 24 required. TypeScript strict mode is on — no `any` without a comment explaining why.

## Git workflow

`main` is protected: no force-push, no deletion, linear history required, squash merge only. External contributors don't have write access, so pull requests are the only way in — fork the repo, branch, and open a PR.

Since merges are squash-only, the **PR title becomes the commit message on `main`**. A required check (`.github/workflows/pr-title-lint.yml`) blocks merging unless the title matches:

```
fix|feat|chore|docs: message
```

Type must be one of `fix`/`feat`/`chore`/`docs`, and the full title must be 72 characters or fewer. Keep it short and specific — this is what shows up in `git log` forever.

## Architecture rules

### Agent Adapter pattern — never break the abstraction

All agent-specific logic lives behind the `AgentAdapter` interface in `src/adapters/types.ts`. The state machine, wait detector, and UI must only call adapter interface methods — never Claude Code hook internals directly.

Adding support for a new agent = write a new file in `src/adapters/`, implement the interface. Nothing else should change.

### Adapter interface (current)

```
onPromptSubmitted()
onNeedsUser()        // permission_prompt or idle_prompt — agent is waiting on the user
onTaskFinished()     // Stop / SubagentStop
```

### Claude Code adapter

Receives events via local HTTP server (hook type `http`). Do not use `command` hooks — the ~500 ms timeout makes them unreliable. Hooks are registered once in `~/.claude/settings.json` so every session in every project reports in.

### State machine

Three states: `idle` → `agent-working` → `needs-user`. Transitions are driven exclusively by adapter events, not by raw hook payloads.

### Wait detector

Runs on top of the state machine. Combines two signals — agent state and `powerMonitor.getSystemIdleTime()` — to decide when to trigger stage 1. Only fires when both conditions hold.

### Game bundles

Games are packaged as bundles from day 1 (even built-in ones): a manifest plus self-contained HTML/JS/assets, communicating with the app through a minimal API:

```
onPause()
onResume()
onAgentDone()
```

Third-party games run in a sandboxed view (`nodeIntegration: false`, no network/filesystem access). This is built into the game-host from the start — far cheaper to design in than to retrofit.

## Key constraints

- **No notifications.** Meanwaile must never nag or interrupt. The soft-open flow and the user's final say on game close are the product's entire UX philosophy.
- **No external integrations.** No OAuth, no Slack, no Gmail, no account. Everything is local.
- **No agent lock-in.** Never add Claude Code–specific logic outside `src/adapters/claude-code.ts`.
- **Wait detection must be conservative.** A false positive (game appears when the user is still reading output) is the primary failure mode. The idle threshold is the sole mitigation — tune with phase-0 data, don't add UX layers to compensate for a threshold that's too low.
- **Games must be mild.** If the game is too good, users start wishing agents were slower. No deep progression, no streaks, no dailies. Rounds of 30–90 s.
- **Agent events always take precedence.** When `onNeedsUser` or `onTaskFinished` arrives mid-game, the game pauses immediately and prompts — continuing to play is always a deliberate act, never the default.
- **macOS and Windows only for MVP.** No Linux code paths yet.
