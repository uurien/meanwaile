module.exports = {
  packagerConfig: {
    name: 'Meanwaile',
    icon: './assets/app-icon',
    osxSign: {},
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
