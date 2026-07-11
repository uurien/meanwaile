# Meanwaile

> Not affiliated with Anthropic, OpenAI, or any AI company.

macOS menu-bar app that detects when your AI coding agent is working and you're idle — and opens a minigame in a small popup to fill the wait. When the agent needs you back, the game pauses and lets you decide.

No notifications. No integrations. One trick, done well.

---

## Status

**Phase 0** — daemon skeleton. The HTTP hook server, agent adapter, and state machine are in place. The popup opens on tray click (on-demand). Automatic wait detection and the game itself are coming next.

---

## Requirements

- macOS 13+
- Node.js 24+

## Build & run

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
    "UserPromptSubmit": [{"hooks": [{"type": "http", "url": "http://localhost:3821/hook"}]}]
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

# Agent finishes
curl -s -X POST http://localhost:3821/hook \
  -H 'Content-Type: application/json' \
  -d '{"hook_event_name":"Stop","session_id":"test"}'
```

## Project structure

```
src/
  adapters/
    types.ts          AgentAdapter interface — the only contract the rest of the app knows
    claude-code.ts    Maps Claude Code hook payloads to AgentEvents
  state-machine.ts    idle / agent_working / needs_user
  main.ts             Electron main: tray, HTTP server (port 3821), popover window
  onboarding-store.ts First-run "already onboarded" flag (~/Library/Application Support/Meanwaile)
  claude-settings.ts  Non-destructive merge of Meanwaile's hooks into ~/.claude/settings.json
  preload.ts          contextBridge setup for renderer IPC
  popover/
    index.html
    popover.css
    popover.js        Game canvas will live here
assets/
  tray-icon.png       22×22 template image (white, transparent background)
scripts/
  setup-hooks.sh      Merges Claude Code hook config into ~/.claude/settings.json
```

## Contributing

New games and agent adapters are the primary contribution surfaces. See `AGENTS.md` for architecture rules and dev setup.

## License

MIT
