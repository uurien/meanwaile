module.exports = {
  packagerConfig: {
    name: 'Meanwaile',
    icon: './assets/app-icon',
    osxSign: {
      // No Apple Developer account: sign ad-hoc so the app still runs on
      // Apple Silicon (required by macOS) instead of relying on a keychain
      // identity that CI runners don't have.
      identity: '-',
      identityValidation: false,
      // @electron/osx-sign's default entitlements omit
      // disable-library-validation, which Electron needs to load its own
      // (ad-hoc signed) Electron Framework under hardened runtime. Without
      // it the app crashes on launch with a "different Team IDs" dyld error.
      optionsForFile: () => ({
        entitlements: './build/entitlements.mac.plist',
      }),
    },
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
  ],
};
