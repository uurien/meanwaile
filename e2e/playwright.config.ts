import { defineConfig } from '@playwright/test';
import * as path from 'path';

export default defineConfig({
  testDir: '.',
  workers: 1,
  timeout: 60_000,
  // Relative paths in this config resolve against e2e/, not the repo root -
  // force the report to repo-root playwright-report/, which is where
  // ci.yml's upload-artifact step (and .gitignore) expect it.
  reporter: [['list'], ['html', { outputFolder: path.join(__dirname, '..', 'playwright-report'), open: 'never' }]],
});
