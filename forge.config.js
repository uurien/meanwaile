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
