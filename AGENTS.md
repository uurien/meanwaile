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

Game sources live in the sibling [meanwaile-games](https://github.com/uurien/meanwaile-games) repo, not in this repo's source control. `games.json` at the repo root pins which `id@version` pairs to install; `npm install`/`npm ci` runs `scripts/install-games.js` as a `postinstall` step, which downloads each game's release zip (tag `<id>@<version>`, asset `<id>-<version>.zip`) and extracts it into `games/<id>/` — a gitignored sibling of `src/`, `dist/`, and `node_modules/`, not nested under `src/`. There's no hand-maintained registry: `src/games-catalog.ts`'s `listGames()` derives the hub's roster at runtime purely from `games.json` (which ids to show, in order) plus each installed game's own `games/<id>/game.json` (name, tagline, entry, preview) — main.ts serves it to the popover over IPC (`games-list` / `window.meanwaile.listGames()`), since the popover window runs with `nodeIntegration: false` and has no direct filesystem access.

Third-party games run in a sandboxed view (`nodeIntegration: false`, no network/filesystem access). This is built into the game-host from the start — far cheaper to design in than to retrofit.

## Key constraints

- **No notifications.** Meanwaile must never nag or interrupt. The soft-open flow and the user's final say on game close are the product's entire UX philosophy.
- **No external integrations.** No OAuth, no Slack, no Gmail, no account. Everything is local.
- **No agent lock-in.** Never add Claude Code–specific logic outside `src/adapters/claude-code.ts`.
- **Wait detection must be conservative.** A false positive (game appears when the user is still reading output) is the primary failure mode. The idle threshold is the sole mitigation — tune with phase-0 data, don't add UX layers to compensate for a threshold that's too low.
- **Games must be mild.** If the game is too good, users start wishing agents were slower. No deep progression, no streaks, no dailies. Rounds of 30–90 s.
- **Agent events always take precedence.** When `onNeedsUser` or `onTaskFinished` arrives mid-game, the game pauses immediately and prompts — continuing to play is always a deliberate act, never the default.
- **macOS, Windows, and Ubuntu (Linux) are the officially supported MVP platforms.** `src/tray-platform.ts` has two confirmed, tested fixes wired into `src/main.ts`: the tray icon (`trayIconFileName` — macOS's template-image auto-inversion has no Linux equivalent) and menu wiring (`shouldPersistContextMenu` — AppIndicator/StatusNotifierItem trays never emit `click`/`right-click` at all, so the context menu must be registered via `tray.setContextMenu()` up front instead of shown on demand).
  Popover **positioning** on Linux/Wayland is an open problem, not a solved one: confirmed on real hardware that `Tray.getBounds()`, `screen.getCursorScreenPoint()`, and `BrowserWindow.setPosition()` (both called after creation and passed to the constructor) are all unreliable-to-useless under GNOME/Mutter's native Wayland backend — clients simply don't get to control window placement there. The popover currently just opens wherever the compositor puts it (observed: top-left), and that's the accepted state for now. Do not re-attempt: (1) forcing `app.commandLine.appendSwitch('ozone-platform', 'x11')` to route through XWayland — tried, caused a GPU-process crash loop (`exit_code=139`) without even fixing `getBounds()`, since AppIndicator icons are managed over D-Bus independent of the app's Ozone backend; (2) a cursor-position or top-right-corner fallback via `setPosition()` — also confirmed ignored. A real fix would need a draggable region so the user can position it manually (Wayland does respect user-initiated moves) — not yet built.
  Packaging is done: `forge.config.js` has a `@electron-forge/maker-deb` entry producing `out/make/deb/x64/*.deb` (needs `bin: 'Meanwaile'` set explicitly — the packaged binary is capitalized, but the maker's default `bin` follows the lowercase `name` and fails to find it otherwise). CI builds it the same way as macOS/Windows: `ci.yml`'s `build-and-test`/`package` matrices and `release-publish.yml`'s `build-linux` job all include Ubuntu, installing `fakeroot`/`dpkg` first since `electron-installer-debian` needs them.
