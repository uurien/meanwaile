#!/usr/bin/env bash
# Installs Meanwaile Claude Code hooks into ~/.claude/settings.json
# Requires: jq

set -euo pipefail

SETTINGS="$HOME/.claude/settings.json"
URL="http://localhost:3821/hook"

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install it with: brew install jq"
  exit 1
fi

hook_entry() {
  echo "[{\"hooks\":[{\"type\":\"http\",\"url\":\"$URL\"}]}]"
}

if [ ! -f "$SETTINGS" ]; then
  echo "{}" > "$SETTINGS"
fi

tmp=$(mktemp)

jq \
  --argjson h "$(hook_entry)" \
  '.hooks.Notification = $h |
   .hooks.Stop = $h |
   .hooks.SubagentStop = $h |
   .hooks.PreToolUse = $h |
   .hooks.UserPromptSubmit = $h' \
  "$SETTINGS" > "$tmp"

mv "$tmp" "$SETTINGS"

echo "Claude Code hooks configured → $SETTINGS"
echo "Start Meanwaile, then restart Claude Code for hooks to take effect."
