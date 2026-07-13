# Meanwaile

> Not affiliated with Anthropic, OpenAI, or any AI company.

macOS menu-bar app that detects when your AI coding agent is working and you're idle — and opens a minigame in a small popup to fill the wait. When the agent needs you back, the game pauses and lets you decide.

No notifications. No integrations. One trick, done well.

---

## Status

Working end to end: the hook server, agent adapter, state machine, first-run onboarding (login item + Claude Code hooks), and the first minigame (circle-tap) are all in place. The popup opens automatically once the agent has been working and the system has been idle past a threshold, and on demand any time via the tray icon.

Not yet built: checking that the terminal/agent app is frontmost before auto-opening (so right now it can open even if you've switched to another app), and discreet mode.

---

## Requirements

- macOS 13+
- To build from source or contribute: Node.js 24+ (only needed for `npm install` / `npm start` / running tests — the packaged app bundles its own Node/Electron runtime, so an installed `.dmg` doesn't need Node at all)

## Install

Download the latest `.dmg` from [Releases](https://github.com/uurien/meanwaile/releases) — no Node.js required.

## Build & run from source

```bash
npm install
npm start
```

`npm start` compiles TypeScript and launches Electron. An icon appears in your menu bar. The app hides from the Dock intentionally. Click the icon to open the popup.

## Configure Claude Code hooks

On first launch, Meanwaile asks two separate questions: whether to launch
automatically at login, and whether to wire up Claude Code's hooks. Answering
"Yes" to the second merges the hook config below into `~/.claude/settings.json`
for you — no manual step needed. Restart Claude Code afterwards for the hooks
to take effect.

If you answered "No", or need to re-apply/repair the hooks manually, run:

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

## Contributing

New games and agent adapters are the primary contribution surfaces. See `AGENTS.md` for architecture rules and dev setup.

## License

MIT
