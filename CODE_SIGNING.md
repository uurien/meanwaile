# Code Signing Policy

This page describes how Meanwaile's release binaries are built, signed, and verified, and who is authorized to approve a release.

## Status

| Platform | Signed today | Certificate provider |
|---|---|---|
| macOS | Yes | Apple Developer ID (notarized) |
| Windows | Not yet | TBD |

Windows installers (`Meanwaile-X.Y.Z Setup.exe`) are unsigned for now; see the [README](README.md#windows) for what that means at install time.

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

### Windows — not signed yet

The current `build-windows` job just runs `electron-forge make` and uploads the resulting Squirrel installer unsigned, as-is — that's why the Status table above says "Not yet." No signing provider is set up or planned at this time.

## Security practices

- Multi-factor authentication (MFA) is enabled on the GitHub account.
- Today, the macOS signing certificate is a `.p12` file held as a GitHub Actions secret, imported into the runner's keychain only for the duration of the `build-macos` job.

## Privacy

Meanwaile does not collect, transmit, or store any user data. It runs entirely locally: a local HTTP server on the user's own machine that receives hook events from Claude Code / Codex, with no network calls, telemetry, or analytics of any kind. There is nothing to disclose and nothing to opt out of.

## Verifying a signed binary (Windows)

Once Windows signing is set up, you'll be able to confirm a downloaded installer is genuinely signed:

- Right-click `Meanwaile-X.Y.Z Setup.exe` → **Properties** → **Digital Signatures** tab, and check the signer listed there.
- Or from PowerShell: `Get-AuthenticodeSignature ".\Meanwaile-X.Y.Z Setup.exe"` should report `Status: Valid`.

## Reporting a problem

If you believe a release binary has been tampered with, or you've found a security issue, please open a [GitHub issue](https://github.com/uurien/meanwaile/issues), or use GitHub's private [security advisory](https://github.com/uurien/meanwaile/security/advisories) reporting for sensitive reports.
