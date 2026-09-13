# Meanwaile

> Not affiliated with Anthropic, OpenAI, or any AI company.

macOS menu-bar app that detects when your AI coding agent is working and you're idle — and opens a minigame in a small popup to fill the wait. When the agent needs you back, the game pauses and lets you decide.

Optionally, it can also show a quiet native notification when a principal agent needs your attention or finishes, and a live **Agents** view of what's currently working. Automatic games and notifications are two independent switches — turn on either, both, or neither.

No account. No external integrations. No productivity surveillance.

---

## Status

Working end to end: the hook server, agent adapters for Claude Code and Codex, per-execution tracking for concurrent agents, state machine, first-run onboarding (login item + agent hooks), settings, native notifications, the **Games** / **Agents** popup, and two minigames (circle-tap, Meanwaile Runner) are all in place. The popup opens automatically once an agent has been working and the system has been idle past the configured threshold, pauses when any principal agent needs input or finishes (even if another is still working), and opens on demand any time via the tray icon. `SubagentStop` is ignored throughout.

---

## Requirements

- macOS 13+, Windows 10/11, or Ubuntu (64-bit, via the `.deb` package)
- To build from source or contribute: Node.js 24+ (only needed for `npm install` / `npm start` / running tests — the packaged app bundles its own Node/Electron runtime, so an installed build doesn't need Node at all)

## Install

### macOS

Download the latest `.dmg` from [Releases](https://github.com/uurien/meanwaile/releases) — no Node.js required. The app is signed with a Developer ID and notarized by Apple, so macOS only shows the standard "downloaded from the internet" confirmation on first launch, same as any other signed app.

### Windows

Download the latest `Meanwaile-X.Y.Z Setup.exe` from [Releases](https://github.com/uurien/meanwaile/releases). The Windows build isn't code-signed yet, so Windows SmartScreen and/or your antivirus may flag it as an unrecognized app and block or hold it back for analysis before you can run it. This is expected for now, not a sign anything is wrong.

If it gets blocked:

- **SmartScreen**: click "More info", then "Run anyway".
- **Antivirus / other security software**: you may need to explicitly allow it, restore it from quarantine, or add an exclusion — check your security software's blocked/quarantine history for the installer and mark it as trusted.

See [CODE_SIGNING.md](CODE_SIGNING.md) for the plan to get the Windows build signed, and how to verify a release once it is.

### Linux (Ubuntu)

Download the latest `meanwaile_X.Y.Z_amd64.deb` from [Releases](https://github.com/uurien/meanwaile/releases) and install it with:

```bash
sudo dpkg -i meanwaile_X.Y.Z_amd64.deb
```

Tray support is tested on Ubuntu; other distros/desktop environments aren't verified. One known caveat: under GNOME's native Wayland backend, the popup opens wherever the compositor places it (observed top-left) rather than near the tray icon — this is a Wayland limitation, not a bug in the app.

## Build & run from source

```bash
npm install
npm start
```

`npm start` compiles TypeScript and launches Electron. An icon appears in your menu bar. The app hides from the Dock intentionally. Click the icon to open the popup.

## The popup: Games and Agents

The popup has two tabs. **Games** (left, shown by default) is the game hub. **Agents** (right) is a read-only view of current agent executions: how many are working, how many need you, and a short list of recently finished ones. It only ever shows the agent name and the project folder's basename — never full paths, prompts, transcripts, tool input, or assistant output. If an active execution produces no hook for 10 minutes, Meanwaile silently discards it instead of treating it as finished or notifying you. The recent-completions list is kept in memory only, capped at 20, and cleared when Meanwaile quits.

The `···` menu in the popup header holds **Add game** and **Settings**.

## Settings

Open **Settings** from the `···` menu. It has three groups:

- **Automation** — *Open games automatically* (on by default) and *Idle time*, the keyboard/mouse idle threshold before the popup may auto-open (default 15 s). Idle time is disabled, but preserved, when auto-open is off.
- **Notifications** — the *Notifications* master switch (off by default), plus *When an agent needs attention*, *When an agent finishes*, and *Sound* (*No sound* by default). The per-event and sound controls are disabled, but preserved, when the master switch is off.
- **Detection** — the *Port* the hook server listens on (default 3821), with a live status readout, and help tooltips on Idle time and Port.

If you change the port and already had hooks installed, Meanwaile asks whether to update the hook URL in `~/.claude/settings.json` (and `~/.codex/hooks.json`) for you — it never rewrites those files silently.

## Notifications

Native notifications are opt-in and entirely local. Only two events can raise one: a principal agent needs your attention, or a principal agent finishes. They are silent by default, carry no prompt or transcript content, and are suppressed while the popup is already visible. Clicking one opens the **Agents** tab and highlights the relevant row — it never focuses or controls the terminal the agent runs in. `SubagentStop` never notifies.

Platform notes: on macOS, packaged builds must be signed for the system to deliver notifications (the DMG releases are). `Notification` support and any OS-level permission prompt are the operating system's; Settings shows whether the local server is running, and the app degrades quietly if the OS reports no notification support.

## Configure Claude Code hooks

On first launch, Meanwaile asks two separate questions: whether to launch
automatically at login, and whether to wire up Claude Code's hooks. Answering
"Yes" to the second merges the hook config below into `~/.claude/settings.json`
for you — no manual step needed. Restart Claude Code afterwards for the hooks
to take effect.

If you answered "No", or need to re-apply/repair the hooks manually, run (requires [`jq`](https://jqlang.org/), install with `brew install jq`):

```bash
./scripts/setup-hooks.sh
```

This merges the following into `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification":     [{"hooks": [{"type": "http", "url": "http://localhost:3821/hook"}]}],
    "Stop":             [{"hooks": [{"type": "http", "url": "http://localhost:3821/hook"}]}],
    "SubagentStop":     [{"hooks": [{"type": "http", "url": "http://localhost:3821/hook"}]}],
    "UserPromptSubmit": [{"hooks": [{"type": "http", "url": "http://localhost:3821/hook"}]}],
    "PreToolUse":       [{"hooks": [{"type": "http", "url": "http://localhost:3821/hook"}]}]
  }
}
```

## Configure Codex hooks

If Codex appears to be installed (`~/.codex` exists), onboarding asks a third
question — whether to wire up Codex's hooks. Answering "Yes" merges the hook
config below into `~/.codex/hooks.json`, and also makes sure `[features].hooks`
is set to `true` in `~/.codex/config.toml` (some Codex versions gate hooks
behind this flag). Codex only executes `command`-type hooks (it has no `http`
hook type like Claude Code), so each installed hook just shells out to `curl`
and forwards its stdin payload to the daemon.

The `config.toml` edit is done with [`smol-toml`](https://www.npmjs.com/package/smol-toml)
purely to *read* the file safely — the actual write is a targeted insertion
of a single `hooks = true` line into your existing `[features]` table (or a
new one if you don't have it yet), never a full rewrite. Every other table,
key, and piece of formatting in your `config.toml` is left untouched.

One manual step Meanwaile still cannot do for you: start the Codex CLI (open
a session) and run `/hooks` once to trust the newly installed hook.

To install manually, merge this into `~/.codex/hooks.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [{"hooks": [{"type": "command", "command": "curl -s -X POST -H \"Content-Type: application/json\" -d @- http://localhost:3821/hook/codex", "timeout": 30}]}],
    "Stop":             [{"hooks": [{"type": "command", "command": "curl -s -X POST -H \"Content-Type: application/json\" -d @- http://localhost:3821/hook/codex", "timeout": 30}]}],
    "SubagentStop":     [{"hooks": [{"type": "command", "command": "curl -s -X POST -H \"Content-Type: application/json\" -d @- http://localhost:3821/hook/codex", "timeout": 30}]}],
    "PreToolUse":       [{"hooks": [{"type": "command", "command": "curl -s -X POST -H \"Content-Type: application/json\" -d @- http://localhost:3821/hook/codex", "timeout": 30}]}],
    "PermissionRequest": [{"matcher": "*", "hooks": [{"type": "command", "command": "curl -s -X POST -H \"Content-Type: application/json\" -d @- http://localhost:3821/hook/codex", "timeout": 30}]}]
  }
}
```

And make sure `~/.codex/config.toml` has, inside its `[features]` table:

```toml
[features]
hooks = true
```

## Test without Claude Code

Send fake hook payloads directly to verify the daemon is running:

```bash
# Agent starts working
curl -s -X POST http://localhost:3821/hook \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"UserPromptSubmit","session_id":"test"}'

# Agent needs the user
curl -s -X POST http://localhost:3821/hook \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"Notification","notification_type":"permission_prompt","session_id":"test"}'

# Agent resumes after the user answers a prompt
curl -s -X POST http://localhost:3821/hook \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"PreToolUse","session_id":"test"}'

# Agent finishes
curl -s -X POST http://localhost:3821/hook \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"Stop","session_id":"test"}'
```

The Codex adapter listens on `/hook/codex` instead, with the same
`hook_event_name` field but `PermissionRequest` in place of `Notification`:

```bash
curl -s -X POST http://localhost:3821/hook/codex \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"UserPromptSubmit","session_id":"test"}'

curl -s -X POST http://localhost:3821/hook/codex \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"PermissionRequest","session_id":"test"}'

curl -s -X POST http://localhost:3821/hook/codex \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"Stop","session_id":"test"}'
```

## Contributing

New games and agent adapters are the primary contribution surfaces. See `AGENTS.md` for architecture rules and dev setup.

## License

MIT
