module.exports = {
  packagerConfig: {
    name: 'Meanwaile',
    icon: './assets/tray-icon',
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
