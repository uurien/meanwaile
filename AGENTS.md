# Agents — Meanwaile

## What this app does

Meanwaile is a desktop tray app (Electron) that detects local AI coding-agent activity. It can offer a minigame while the user waits and can show configurable native notifications when a principal agent needs attention or finishes.

No account, no external integrations, and no productivity surveillance. Automatic games and notifications are independent user choices.

The game popup appears when, and only when, both signals hold simultaneously:

1. **The agent is working** — between `UserPromptSubmit` and `Stop`, with no pending `Notification` (`permission_prompt` / `idle_prompt`). If the agent is waiting on the user, that's terminal time, not game time.
2. **No user activity for the configured idle threshold** — keyboard/mouse idle time via `powerMonitor.getSystemIdleTime()`, user-configurable (default 15–30 s range, tuned in phase 0).

When both signals hold, the popup opens directly — no intermediate hint, no confirmation step. Dismissing costs nothing (Esc or switching apps).

When any principal agent finishes or needs the user, the game **pauses**, even if another principal agent is still working, and prompts with **Close** and **It can wait a bit more**. `SubagentStop` is ignored. The user always has the final say.

The main popup exposes **Games** as its left/default view and **Agents** as its right view. On-demand mode bypasses all detection conditions. If a game is in progress, reopening returns to the game.

Native notifications are opt-in, local, event-specific, silent by default, and suppressed while the popup is visible. Clicking one opens **Agents** and never controls the originating terminal. The activity view and recent in-memory completions never expose full paths, prompts, transcripts, tool input, or assistant output.

The **Agents** summary reports working, needs-attention, and recently-finished principal executions; its active total is working plus needs-attention. Recent completions are kept only in memory, capped at 20, and cleared on exit. A principal-agent completion notification includes the remaining working and needs-attention counts. All visible application copy is English.

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
onTaskFinished()     // principal Stop; SubagentStop is ignored
```

### Claude Code adapter

Receives events via local HTTP server (hook type `http`). Do not use `command` hooks — the ~500 ms timeout makes them unreliable. Hooks are registered once in `~/.claude/settings.json` so every session in every project reports in.

### State machine

Three states: `idle` → `agent-working` → `needs-user`. Transitions are driven by normalized adapter events or the adapter-agnostic silence monitor, never by raw hook payloads.

### Agent liveness

`src/agent-liveness-monitor.ts` maintains one resettable timer per `(adapterId, sessionId)`. Every normalized principal-agent hook refreshes that execution's timer; `task_finished` cancels it. After 60 seconds with no hook, the execution is discarded from both the state machine and execution tracker. This is bookkeeping only: it is not added to recent completions and must never interrupt a game or raise a notification.

### Wait detector

Runs on top of the state machine. Combines two signals — agent state and `powerMonitor.getSystemIdleTime()` — to decide when to trigger stage 1. Only fires when both conditions hold. It is only armed when `autoOpenGames` is on; the setting gates the timer entirely and is independent of notifications.

### Execution tracker

`src/execution-tracker.ts` is a pure projection that runs alongside the state machine on every adapter event. Identity is the `(adapterId, sessionId)` composite (never `sessionId` alone), so Claude and Codex sessions that happen to share an id stay distinct. It emits a snapshot (`active` executions, `recent` completions, and `counts` of `working` / `needsUser` / `active` / `finished`) plus whether the event was a significant transition (`started` / `resumed` / `needs_user` / `finished`). Active executions are discarded by the silence monitor after 60 seconds without a hook. `recent` is in-memory only, capped at 20, newest first; records older than 24 h expire silently. Only sanitized fields are kept — `agentName`, `projectName` (the `cwd` basename), timestamps — never paths, prompts, transcripts, tool input, or assistant output.

### Notification service

`src/notification-service.ts` turns significant `needs_user` / `finished` transitions into native notifications behind an injected `NotificationPlatform` facade (so it's Electron-free and unit-tested). It no-ops unless `notificationsEnabled`, respects `notifyNeedsUser` / `notifyFinished` independently, stays silent unless `notificationSound === 'system'`, and is suppressed while the popover is visible. `src/notification-copy.ts` builds the multi-agent wording (singular/plural, post-removal remaining counts). Clicking a notification opens the **Agents** view only.

### Settings model

`AppSettings` (`src/settings-store.ts`): `httpPort` (3821), `autoOpenDelaySeconds` (15), `autoOpenGames` (`true`), `notificationsEnabled` (`false`), `notifyNeedsUser` (`true`), `notifyFinished` (`true`), `notificationSound` (`'none' | 'system'`, default `'none'`). Legacy two-field `settings.json` files migrate forward: missing `autoOpenGames` → `true`, missing `notificationsEnabled` → `false`. Unknown keys are ignored; known-but-invalid values are rejected on save and fall back to the default on read.

### Game bundles

Games are packaged as bundles from day 1 (even built-in ones): a manifest plus self-contained HTML/JS/assets, communicating with the app through a minimal API:

```
onPause()
onResume()
onAgentDone()
```

Game sources live in the sibling [meanwaile-games](https://github.com/uurien/meanwaile-games) repo, not in this repo's source control. `games.json` at the repo root pins which `id@version` pairs to install; `npm install`/`npm ci` runs `scripts/install-games.js` as a `postinstall` step, which downloads each game's release zip (tag `<id>@<version>`, asset `<id>-<version>.zip`) and extracts it into `games/<id>/` — a gitignored sibling of `src/`, `dist/`, and `node_modules/`, not nested under `src/`. There's no hand-maintained registry: `src/games-catalog.ts`'s `listGames()` derives the hub's roster at runtime purely from `games.json` (which ids to show, in order) plus each installed game's own `games/<id>/game.json` (name, tagline, entry, preview) — main.ts serves it to the popover over IPC (`games-list` / `window.meanwaile.listGames()`), since the popover window runs with `nodeIntegration: false` and has no direct filesystem access.

Third-party games run in a sandboxed view (`nodeIntegration: false`, no network/filesystem access). This is built into the game-host from the start — far cheaper to design in than to retrofit.

## Key constraints

- **Notifications stay quiet and local.** Only principal-agent attention and completion events may notify. Controls are independent from automatic game opening, event-specific, silent by default, and notifications are suppressed while the popup is visible.
- **No external integrations.** No OAuth, no Slack, no Gmail, no account. Everything is local.
- **No agent lock-in.** Never add Claude Code–specific logic outside `src/adapters/claude-code.ts`.
- **Wait detection must be conservative.** A false positive (game appears when the user is still reading output) is the primary failure mode. The idle threshold is the sole mitigation — tune with phase-0 data, don't add UX layers to compensate for a threshold that's too low.
- **Games must be mild.** If the game is too good, users start wishing agents were slower. No deep progression, no streaks, no dailies. Rounds of 30–90 s.
- **Principal-agent events always take precedence.** When `onNeedsUser` or `onTaskFinished` arrives mid-game, the game pauses immediately and prompts, even if other principal agents are working. `SubagentStop` never pauses, notifies, or changes counts. Continuing to play is always a deliberate act, never the default.
- **macOS, Windows, and Ubuntu (Linux) are the officially supported MVP platforms.** `src/tray-platform.ts` has two confirmed, tested fixes wired into `src/main.ts`: the tray icon (`trayIconFileName` — macOS's template-image auto-inversion has no Linux equivalent) and menu wiring (`shouldPersistContextMenu` — AppIndicator/StatusNotifierItem trays never emit `click`/`right-click` at all, so the context menu must be registered via `tray.setContextMenu()` up front instead of shown on demand).
  Popover **positioning** on Linux/Wayland is an open problem, not a solved one: confirmed on real hardware that `Tray.getBounds()`, `screen.getCursorScreenPoint()`, and `BrowserWindow.setPosition()` (both called after creation and passed to the constructor) are all unreliable-to-useless under GNOME/Mutter's native Wayland backend — clients simply don't get to control window placement there. The popover currently just opens wherever the compositor puts it (observed: top-left), and that's the accepted state for now. Do not re-attempt: (1) forcing `app.commandLine.appendSwitch('ozone-platform', 'x11')` to route through XWayland — tried, caused a GPU-process crash loop (`exit_code=139`) without even fixing `getBounds()`, since AppIndicator icons are managed over D-Bus independent of the app's Ozone backend; (2) a cursor-position or top-right-corner fallback via `setPosition()` — also confirmed ignored. A real fix would need a draggable region so the user can position it manually (Wayland does respect user-initiated moves) — not yet built.
  Packaging is done: `forge.config.js` has a `@electron-forge/maker-deb` entry producing `out/make/deb/x64/*.deb` (needs `bin: 'Meanwaile'` set explicitly — the packaged binary is capitalized, but the maker's default `bin` follows the lowercase `name` and fails to find it otherwise). CI builds it the same way as macOS/Windows: `ci.yml`'s `build-and-test`/`package` matrices and `release-publish.yml`'s `build-linux` job all include Ubuntu, installing `fakeroot`/`dpkg` first since `electron-installer-debian` needs them.
