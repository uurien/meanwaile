// CI (release-publish.yml) imports a Developer ID Application certificate
// into a temporary keychain and sets APPLE_TEAM_ID before packaging. Local
// dev machines without that certificate fall back to ad-hoc signing.
const hasAppleCredentials = Boolean(process.env.APPLE_TEAM_ID);

module.exports = {
  packagerConfig: {
    name: 'Meanwaile',
    icon: './assets/app-icon',
    osxSign: hasAppleCredentials
      ? {
          // No `identity` set: @electron/osx-sign auto-discovers the
          // "Developer ID Application" identity in the keychain CI just
          // imported.
          /* v8 ignore next 3 -- only invoked by electron-forge's native signing step */
          optionsForFile: () => ({
            entitlements: './build/entitlements.mac.plist',
          }),
        }
      : {
          // No Apple Developer account: sign ad-hoc so the app still runs on
          // Apple Silicon (required by macOS) instead of relying on a keychain
          // identity that dev machines don't have.
          identity: '-',
          identityValidation: false,
          // @electron/osx-sign's default entitlements omit
          // disable-library-validation, which Electron needs to load its own
          // (ad-hoc signed) Electron Framework under hardened runtime. Without
          // it the app crashes on launch with a "different Team IDs" dyld error.
          /* v8 ignore next 3 -- only invoked by electron-forge's native signing step */
          optionsForFile: () => ({
            entitlements: './build/entitlements.mac.plist',
          }),
        },
    osxNotarize: hasAppleCredentials
      ? {
          appleApiKey: process.env.APPLE_API_KEY_PATH,
          appleApiKeyId: process.env.APPLE_API_KEY_ID,
          appleApiIssuer: process.env.APPLE_API_ISSUER,
        }
      : undefined,
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'Meanwaile',
        setupIcon: './assets/app-icon.ico',
        // No code signing certificate yet, so the Setup.exe and installed
        // app trigger a SmartScreen warning — see AGENTS.md for the
        // Windows-support follow-ups (code signing, CI job).
      },
    },
  ],
};
