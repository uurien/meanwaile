# Code Signing Policy

This page describes how Meanwaile's release binaries are built, signed, and verified, and who is authorized to approve a release.

## Status

| Platform | Signed today | Certificate provider |
|---|---|---|
| macOS | Yes | Apple Developer ID (notarized) |
| Windows | Not yet — application to [SignPath Foundation](https://signpath.org) in progress | SignPath.io (pending) |

Windows installers (`Meanwaile-X.Y.Z Setup.exe`) built before Windows signing goes live are unsigned; see the [README](README.md#windows) for what that means at install time.

## Team roles

Meanwaile is maintained by a single person. All roles below are currently held by the same maintainer.

| Role | Person | Responsibility |
|---|---|---|
| Author | Ugaitz Urien ([@uurien](https://github.com/uurien)) | Writes and commits source code |
| Reviewer | Ugaitz Urien | Reviews any external contribution before merge |
| Approver | Ugaitz Urien | Manually approves every Windows signing request before a release is signed |

## Build & release process

- Releases are built exclusively from the `main` branch by GitHub Actions (`.github/workflows/release-publish.yml`), triggered only when a `release/vX.Y.Z` branch is merged.
- macOS and Windows artifacts are built in isolated, ephemeral GitHub-hosted runners — no locally-built binary is ever published as a release asset.
- The release tag and GitHub Release are produced by that same automated pipeline, from the same commit that was built — nothing is re-packaged or modified afterwards.

### macOS — already signed and notarized

- The `build-macos` job imports an Apple Developer ID Application certificate into a temporary keychain from a base64-encoded `.p12` secret, used only for that job's runner and discarded when it ends.
- `electron-forge make` signs the app via `osxSign` (configured in `forge.config.js`).
- The signed app is then notarized with Apple via `osxNotarize`, authenticated with an App Store Connect API key — this is what lets macOS show only the standard "downloaded from the internet" prompt instead of blocking the app.

### Windows — planned, not implemented yet

Nothing below is live today. The current `build-windows` job just runs `electron-forge make` and uploads the resulting Squirrel installer unsigned, as-is — that's why the Status table above says "Not yet."

The intended flow, once the SignPath Foundation application is approved and wired into CI:

1. `electron-forge make` produces the unsigned installer, same as today.
2. The CI job submits it to SignPath as a signing request.
3. The maintainer manually approves that request in SignPath's dashboard (see Team roles above) — there is no auto-approval path.
4. The signed result replaces the unsigned one before it's attached to the GitHub release.

## Security practices

- Multi-factor authentication (MFA) is enabled on the GitHub account, and will be enabled on the SignPath account as well.
- Today, the macOS signing certificate is a `.p12` file held as a GitHub Actions secret, imported into the runner's keychain only for the duration of the `build-macos` job.
- Once Windows signing via SignPath is active, its private key will live exclusively in SignPath's HSM-backed infrastructure — it will never touch this project's CI runners or the maintainer's machine, unlike the current macOS certificate.

## Privacy

Meanwaile does not collect, transmit, or store any user data. It runs entirely locally: a local HTTP server on the user's own machine that receives hook events from Claude Code / Codex, with no network calls, telemetry, or analytics of any kind. There is nothing to disclose and nothing to opt out of.

## Verifying a signed binary (Windows)

Once Windows signing is active, you can confirm a downloaded installer is genuinely signed:

- Right-click `Meanwaile-X.Y.Z Setup.exe` → **Properties** → **Digital Signatures** tab, and check the signer listed there.
- Or from PowerShell: `Get-AuthenticodeSignature ".\Meanwaile-X.Y.Z Setup.exe"` should report `Status: Valid`.

## Reporting a problem

If you believe a release binary has been tampered with, or you've found a security issue, please open a [GitHub issue](https://github.com/uurien/meanwaile/issues), or use GitHub's private [security advisory](https://github.com/uurien/meanwaile/security/advisories) reporting for sensitive reports.

## Attribution

Free code signing for Windows releases is provided by [SignPath.io](https://signpath.io), with the certificate issued by the [SignPath Foundation](https://signpath.org) for qualifying open source projects.
