# Main-process refactor: target architecture and roadmap

## Status

Planning document. Nothing in this doc has been implemented yet except where a
step is explicitly marked done. Steps are meant to land one at a time, each as
its own small, reviewable, behavior-preserving change.

## Why this doc exists

Most of `src/` is already organized reasonably well: adapters, the state
machine, the execution tracker, the notification service, the settings store,
the games catalog/installer are each in their own file, are largely
Electron-free, and are unit tested in isolation. That part of the codebase is
worth keeping and extending as-is.

`src/main.ts` is the exception. At 834 lines it is by far the largest file in
the project, and it currently owns almost every kind of responsibility the app
has: app lifecycle, the tray icon, three separate browser windows, an HTTP
server, onboarding dialogs, all IPC handler registration, and the orchestration
logic that actually decides when to notify or auto-open a game. `tests/main.test.ts`
(1824 lines) and `tests/main-integration.test.ts` (520 lines) are, together,
close to half of the project's total test code — a direct symptom of one file
carrying too many concerns to test in isolation.

This doc describes the target shape for the main process and the order in
which to get there without a big-bang rewrite.

## Current responsibilities mixed into `main.ts`

1. **App bootstrap/lifecycle** — the Windows-installer relaunch check (Squirrel,
   Electron's Windows installer, restarts the app with special flags during
   install/update/uninstall just to update the Start Menu shortcut; this
   check quits immediately for those launches so the rest of the app never
   starts), dock icon setup, `app.on('ready')`, `app.on('before-quit')`.
2. **Tray** — icon, tooltip, context menu, click/right-click handling.
3. **Window management** — creating and showing three `BrowserWindow`
   instances (popover, settings, gallery), each with near-identical
   `webPreferences` boilerplate, plus the popover's platform-specific
   positioning logic (macOS/Windows vs. Linux).
4. **HTTP hook server** — accepting hook POSTs and dispatching them to the
   right adapter.
5. **Onboarding flows** — three async functions driving dialog sequences and
   orchestrating Claude/Codex hook installation.
6. **IPC wiring** — 13 `ipcMain.on`/`ipcMain.handle` registrations, the glue
   between `preload.ts` and everything else.
7. **The event orchestrator** (`handleAgentEvent`) — wires the state machine,
   execution tracker, liveness monitor, notification service, and the
   auto-open timer together. This is the real application logic of the app
   (when does a game open, when does a notification fire), not Electron
   plumbing, and today it's buried inside `app.on('ready')`.
8. **Gallery catalog annotation** (`annotateCatalog`) — cross-referencing the
   live catalog against what's installed.

None of this is wrong in isolation — it's just all in one file with no
internal module boundaries, so nothing on this list can be tested, read, or
changed without pulling in the rest.

## Target architecture

No DI framework, no new abstractions beyond plain modules and factory
functions — this mirrors the style already used for adapters and
`NotificationService` (a small dependency object/facade injected in, rather
than importing Electron directly). Three layers:

```
src/
  # Domain / services layer — already exists, mostly unchanged.
  # Electron-free, unit tested in isolation.
  adapters/
  state-machine.ts
  execution-tracker.ts
  notification-service.ts
  agent-liveness-monitor.ts
  settings-store.ts
  games-catalog.ts
  games-gallery.ts
  game-installer.ts

  # Orchestration layer — new. The application logic that ties domain
  # services together. Takes its Electron-facing dependencies as injected
  # facades (same pattern as NotificationPlatform), so it stays testable
  # without a real BrowserWindow/Tray.
  app-controller.ts   # handleAgentEvent + onboarding flows + http server lifecycle

  # Electron infrastructure layer — new. Nothing outside this layer touches
  # BrowserWindow/Tray directly.
  windows/
    window-factory.ts    # shared BrowserWindow boilerplate (preload, contextIsolation, nodeIntegration)
    popover-window.ts     # create/show/hide/toggle + positioning
    settings-window.ts
    gallery-window.ts
  tray.ts                 # icon, tooltip, context menu, click handling

  ipc/
    activity-ipc.ts        # activity-get, agent-interruption
    settings-ipc.ts         # settings-get, settings-save
    gallery-ipc.ts           # gallery-list, gallery-install, gallery-uninstall
    popover-ipc.ts            # open-popover, popover-view-get, popover-close

  # Shared IPC contract, used by both the main process and preload.
  ipc-channels.ts
  preload.ts

  main.ts   # composition root only: build services, build windows, call each
            # registerXxxIpc(), wire app.on('ready') / before-quit. Target: <100 lines.
```

`tests/` already mirrors `src/`'s structure in most places (`tests/popover/`,
`tests/adapters/`, `tests/gallery/`), so this refactor keeps that convention:
new folders get matching test folders (`tests/windows/`, `tests/ipc/`), and
`tests/main.test.ts`/`tests/main-integration.test.ts` should shrink
significantly as their content moves to live next to the code it tests.

### Why this split

- It's a direct extension of the pattern already in use (adapters, injected
  facades), not a new architecture imported from elsewhere.
- It separates things that change for different reasons: business logic
  (when to notify, when to offer a game) vs. Electron infrastructure (how a
  window gets created, how the popover gets positioned) vs. transport
  (IPC channel names, the HTTP server).
- It's the same idea the project's Agent Adapter pattern already enforces one
  level down ("the state machine, wait detector, and UI must only call
  adapter interface methods") — applied one level up: nothing outside
  `windows/`/`tray.ts` should touch `BrowserWindow`/`Tray` directly.
- Exactly three layers. No layer is added without a concrete file that needs
  it today.

## Incremental roadmap

Each step below should land as its own PR: small, behavior-preserving (no
functional changes, no new user-facing behavior), and reviewable on its own
before the next step starts. This lets us stay aware of what's changing
instead of ending up with another big, hard-to-follow file.

### Step 1 — `preload.ts` + `ipc-channels.ts`

**Status: done.**

The smallest, lowest-risk step, and the natural starting point since it
defines the contract every later IPC step will build on.

**Problem A: everything in `preload.ts` is typed `unknown`.** All 15 methods
exposed on `window.meanwaile` (`getSettings`, `listGames`, `getActivity`,
etc.) accept and return `unknown`, even though real types already exist
elsewhere in the codebase for almost all of them:

| Exposed method | Existing real type |
|---|---|
| `onStateChange` | `StateSnapshot` (`state-machine.ts`) |
| `getSettings` / `saveSettings` | `AppSettings`, `ValidationResult` (`settings-store.ts`) |
| `listGames` | `GameManifest[]` (`games-catalog.ts`) |
| `listCatalog` | `CatalogResult` (`games-gallery.ts`) |
| `getActivity` / `onActivityChange` | `ExecutionSnapshot` (`execution-tracker.ts`) |
| `openPopover` / `getPopoverView` | `PopoverView` — currently private to `main.ts`, needs exporting |
| `getServerStatus` | `ServerStatus` — currently private to `main.ts`, needs exporting |
| `onAgentInterruption` | ad-hoc `{ transition, execution, counts }` payload — currently unnamed |

`unknown` throws away that contract exactly at the one boundary where it
matters most: the only door between the main process and the renderer.

**Change:** define an explicit `MeanwaileApi` interface in `preload.ts` using
these real types instead of `unknown`, exporting `PopoverView` and
`ServerStatus` out of `main.ts` so `preload.ts` can import them, and naming
the `agent-interruption` payload type.

**Problem B: IPC channel names are duplicated string literals.** Every
channel (`'settings-get'`, `'gallery-install'`, `'agent-interruption'`,
`'popover-close'`, ...) is written out by hand twice: once in `preload.ts`
(where `ipcRenderer.invoke`/`send`/`on` is called) and again in `main.ts`
(where `ipcMain.handle`/`on` registers it). There is no single source of
truth — a typo on either side is not caught by the compiler, only by a test
that happens to cover it, or by a runtime failure.

**Change:** add `src/ipc-channels.ts` exporting a `CHANNELS` constant object,
and have `preload.ts` import channel names from it instead of hardcoding
strings. `main.ts`'s `ipcMain` registrations switch to the same constants in
Step 4, once the `ipc/` modules exist — Step 1 only needs `preload.ts` to
consume it, since that's the file being fixed right now.

**Gotcha found while implementing this: `preload.ts` needs its own bundling
step.** Electron sandboxes preload scripts by default (Electron 20+); inside
that sandbox `require()` is a polyfill that only resolves `electron`,
`events`, `timers`, `url` — never a project-local file. Once `preload.ts`
imports the real `CHANNELS` value (not just a type) from `ipc-channels.ts`,
`tsc` compiles that to `require('./ipc-channels')`, which the sandboxed
preload can't resolve — it fails to load at all, silently leaving
`window.meanwaile` undefined at runtime (caught by the e2e suite, not the
Vitest unit tests, since only Playwright launches a real sandboxed Electron
window). This only affects code that runs *inside* `preload.ts` — `main.ts`
is the unsandboxed main process and can `require()`/`import` `ipc-channels.ts`
normally in Step 4, no special handling needed there.

Fix: `scripts/bundle-preload.js` runs after `tsc` (as part of `npm run
build`) and inlines `dist/preload.js`'s local requires with esbuild, leaving
`electron` as the only external `require()` in the output. `sandbox` stays
enabled on all three windows — nothing about `main.ts`'s webPreferences
changes.

**Out of scope for this step:** `popover.js` / `settings.js` / `gallery.js`
stay plain JS with no type checking (they aren't compiled by `tsc` — no
`allowJs` in `tsconfig.json`); converting them to TypeScript, if ever done, is
a separate later decision. `main.ts`'s internal logic is untouched beyond
exporting the two types above.

**Verification:** this is a typing/organization change with no behavior
change. `tests/preload.test.ts` asserts channel names as literal strings,
which keeps passing once those literals live in `ipc-channels.ts` with the
same values. `tests/scripts/bundle-preload.test.ts` covers the new bundling
script. Run the existing suite, `tsc`, and the e2e suite (`npm run
test:e2e`) — the e2e suite is what actually exercises a real sandboxed
preload and would have caught the gotcha above.

### Step 2 — `window-factory.ts` + `windows/*.ts`

Extract the three `BrowserWindow` creation blocks (popover, settings,
gallery) out of `main.ts` into `windows/popover-window.ts`,
`windows/settings-window.ts`, `windows/gallery-window.ts`, sharing the
repeated `webPreferences` boilerplate (`preload`, `contextIsolation: true`,
`nodeIntegration: false`) through a `window-factory.ts` helper. The popover's
positioning logic (`popoverPosition`, `topRightPosition`, the
macOS/Windows-vs-Linux branch in `showPopover`) moves with it.

Mechanical, low-risk: each window's create/show/hide functions move
file-for-file with minimal changes, and each gets its own test file mirroring
today's window-related tests in `tests/main.test.ts`.

### Step 3 — `tray.ts`

Extract tray icon creation, tooltip updates (`refreshTray`), and the context
menu (including the Linux `setContextMenu` persistence quirk) into their own
module. Depends on Step 2 only in that `tray.ts` needs a reference to
`togglePopover` from `windows/popover-window.ts`.

### Step 4 — `ipc/*.ts`

Split the 13 `ipcMain.on`/`ipcMain.handle` registrations by domain into
`ipc/activity-ipc.ts`, `ipc/settings-ipc.ts`, `ipc/gallery-ipc.ts`,
`ipc/popover-ipc.ts`, each exporting a single `registerXxxIpc(deps)`
function called from `main.ts`. This is where `ipc-channels.ts` (Step 1)
gets consumed on the `main.ts` side too, closing the loop so no channel name
is hardcoded anywhere.

### Step 5 — `app-controller.ts`

The step with the most actual logic to move: `handleAgentEvent`, the three
onboarding functions (`runOnboardingIfNeeded`, `offerHookBackfillIfNeeded`,
`offerCodexHookBackfillIfNeeded`), and the HTTP server lifecycle
(`startHttpServer`/`stopHttpServer`/`applySettings`). These get pulled into
`app-controller.ts` as functions/a small object taking their Electron-facing
dependencies as injected facades (dialogs, the popover's `webContents.send`,
etc.) — the same shape `NotificationService` already uses — so this
orchestration logic can finally be unit tested without booting a real
Electron app.

### Step 6 — `main.ts` becomes the composition root

What's left in `main.ts` after Steps 1–5: construct the domain services,
call the `windows/`, `tray.ts`, `ipc/*.ts`, and `app-controller.ts`
factories, and wire `app.on('ready')` / `app.on('before-quit')`. Target
under 100 lines.

## Non-goals

- No rewrite of the domain/services layer (adapters, state machine, execution
  tracker, etc.) — it already follows a good pattern.
- No dependency-injection framework or new abstraction layers beyond the
  three described above.
- No behavior changes bundled into these refactor steps. Any actual bug fix
  or feature found along the way should be its own separate change, following
  the TDD process this project already requires.
- No renderer-side rewrite (`popover.js`/`settings.js`/`gallery.js` staying
  JS) as part of this plan — that's a separate decision to make later if the
  team wants it.
