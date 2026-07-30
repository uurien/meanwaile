import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  workers: 1,
  timeout: 30_000,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
});
