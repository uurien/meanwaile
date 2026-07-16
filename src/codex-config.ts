import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'smol-toml';

// Some Codex versions gate hooks behind [features].hooks in config.toml.
// Real installs (see this repo's history) already have their own [features]
// table with unrelated keys (e.g. js_repl), so this can never do a naive
// `append a new [features] table` — that would produce a duplicate table
// header, which is invalid TOML and would break the user's config. Instead:
// smol-toml is used read-only, purely to detect the current state (is
// [features] present, is hooks already true); the actual edit is a targeted
// line insertion/replacement on the raw text, so every other table, key,
// comment, and formatting choice in the user's file is left byte-for-byte
// untouched.
export function ensureCodexHooksFeatureEnabled(configPath: string): void {
  const raw = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';

  let parsed: Record<string, unknown>;
  try {
    parsed = raw.trim() === '' ? {} : (parse(raw) as Record<string, unknown>);
  } catch {
    console.warn(`[meanwaile] could not parse ${configPath} — leaving it untouched`);
    return;
  }

  const features = parsed.features as Record<string, unknown> | undefined;
  if (features && features.hooks === true) return;

  fs.mkdirSync(path.dirname(configPath), { recursive: true });

  const lines = raw.length > 0 ? raw.split('\n') : [];
  const tableHeaderIndex = lines.findIndex((line) => /^\[features\]\s*$/.test(line.trim()));

  if (tableHeaderIndex === -1) {
    const prefix = raw.length > 0 && !raw.endsWith('\n') ? '\n' : '';
    const separator = raw.length > 0 ? '\n' : '';
    fs.writeFileSync(configPath, `${raw}${prefix}${separator}[features]\nhooks = true\n`);
    return;
  }

  let tableEnd = lines.length;
  for (let i = tableHeaderIndex + 1; i < lines.length; i++) {
    if (/^\[.*\]\s*$/.test(lines[i].trim())) {
      tableEnd = i;
      break;
    }
  }

  const hooksLineOffset = lines
    .slice(tableHeaderIndex + 1, tableEnd)
    .findIndex((line) => /^hooks\s*=/.test(line.trim()));

  if (hooksLineOffset === -1) {
    lines.splice(tableHeaderIndex + 1, 0, 'hooks = true');
  } else {
    lines[tableHeaderIndex + 1 + hooksLineOffset] = 'hooks = true';
  }

  fs.writeFileSync(configPath, lines.join('\n'));
}
