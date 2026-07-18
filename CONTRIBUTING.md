# Contributing to Meanwaile

Thanks for considering a contribution. `main` is protected — external contributors don't have write access, so pull requests are the only way in: fork the repo, branch, and open a PR.

## Setup

```bash
npm install
npm start        # build (tsc) + launch Electron
```

Node.js 24+ is required (see `.nvmrc`).

## Tests

Write tests however you like — before, after, alongside, doesn't matter. What matters is that CI enforces **100% coverage** (statements, branches, functions, lines — see `vitest.config.ts`). A PR that drops coverage won't pass.

```bash
npm test -- --coverage
```

Run this locally before opening a PR.

## Commit / PR title convention

`main` only accepts squash merges, so your **PR title becomes the commit message on `main`** — a required check blocks merging if it doesn't match:

```
fix|feat|chore|docs: message
```

- Type must be one of `fix`, `feat`, `chore`, `docs`.
- Message is required and the whole title (type + message) must be 72 characters or less — keep it short and specific.
- Examples: `fix: prevent double game launch on fast idle toggling`, `docs: add CONTRIBUTING.md`.

Edit the PR title (not just individual commit messages) to fix a failing check — CI re-runs automatically when you do.

Note: GitHub lets whoever clicks "squash and merge" edit the commit message box at that moment, so this check can't force the *final* commit message — please don't rewrite it into something that breaks the pattern.

## Code style

TypeScript strict mode is on. No `any` without a comment explaining why it's unavoidable.

## Architecture rules

- **Agent Adapter pattern.** All agent-specific logic lives behind the `AgentAdapter` interface (`src/adapters/types.ts`). The state machine, wait detector, and UI only call adapter methods — never agent-specific internals directly. Adding support for a new coding agent means writing a new file in `src/adapters/`; nothing else should change.
- **State machine has three states**: `idle` → `agent-working` → `needs-user`, driven only by adapter events, never by raw hook payloads.

## Product constraints — please don't fight these in a PR

Meanwaile has a deliberately narrow product philosophy. PRs that work but go against it will be asked to change scope:

- **No notifications, ever.** The app never nags or interrupts. No toast, no badge, no sound.
- **No agent lock-in.** Nothing agent-specific outside `src/adapters/`.
- **Wait detection is conservative by design.** A false positive (game opens while the user is still reading output) is the failure mode we protect against. Don't make triggering more aggressive to fix a missed case — tune the idle threshold instead.
- **Games stay mild.** No deep progression, no streaks, no dailies. Rounds of 30–90s. The game should never make anyone wish their agent were slower.
- **Agent events always win.** If `onNeedsUser` or `onTaskFinished` fires mid-game, the game pauses immediately — continuing to play is always a deliberate choice, never the default.

## Scope

macOS only for now — no Linux/Windows code paths yet. If you want to work on a new platform, open an issue first to coordinate before sending a PR.

## Reporting bugs / proposing features

Open an issue. For bugs, include: macOS version, Meanwaile version, which coding agent/adapter you were using, and steps to reproduce. For features, explain the use case before jumping to implementation — see the product constraints above first, since a lot of "obvious" features (notifications, integrations, deeper game progression) are intentionally out of scope.
