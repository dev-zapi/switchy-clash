import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    // Chrome extensions require headed Chromium with persistent context
    // Tests use custom fixtures to launch with --load-extension
    headless: false,
  },
});
