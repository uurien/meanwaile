# Meanwaile

> Not affiliated with Anthropic, OpenAI, or any AI company.

macOS menu-bar app that detects when your AI coding agent is working and you're idle — and opens a minigame in a small popup to fill the wait. When the agent needs you back, the game pauses and lets you decide.

No notifications. No integrations. One trick, done well.

---

## Status

Working end to end: the hook server, agent adapters for Claude Code and Codex, state machine, first-run onboarding (login item + agent hooks), settings (HTTP port, idle threshold), and two minigames (circle-tap, Meanwaile Runner) are all in place. The popup opens automatically once an agent has been working and the system has been idle past the configured threshold, pauses when the agent needs input or finishes, and opens on demand any time via the tray icon.

---

## Requirements

- macOS 13+ or Windows 10/11
- To build from source or contribute: Node.js 24+ (only needed for `npm install` / `npm start` / running tests — the packaged app bundles its own Node/Electron runtime, so an installed build doesn't need Node at all)

## Install

### macOS

Download the latest `.dmg` from [Releases](https://github.com/uurien/meanwaile/releases) — no Node.js required. The app is signed with a Developer ID and notarized by Apple, so macOS only shows the standard "downloaded from the internet" confirmation on first launch, same as any other signed app.

### Windows

Download the latest `Meanwaile-X.Y.Z Setup.exe` from [Releases](https://github.com/uurien/meanwaile/releases). The Windows build isn't code-signed yet, so Windows SmartScreen and/or your antivirus may flag it as an unrecognized app and block or hold it back for analysis before you can run it. This is expected for now, not a sign anything is wrong.

If it gets blocked:

- **SmartScreen**: click "More info", then "Run anyway".
- **Antivirus / other security software**: you may need to explicitly allow it, restore it from quarantine, or add an exclusion — check your security software's blocked/quarantine history for the installer and mark it as trusted.

## Build & run from source

```bash
npm install
npm start
```

`npm start` compiles TypeScript and launches Electron. An icon appears in your menu bar. The app hides from the Dock intentionally. Click the icon to open the popup.

## Settings

Click the ⚙ icon inside the popup to open the settings window, where you can change the HTTP port the hook server listens on and the idle threshold before the popup auto-opens. If you change the port and already had hooks installed, Meanwaile asks whether to update the hook URL in `~/.claude/settings.json` for you.

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
