const { defineConfig, devices } = require('@playwright/test');

const slowMoMs = Number.parseInt(process.env.PW_SLOWMO ?? '', 10);
const launchOptions =
  Number.isFinite(slowMoMs) && slowMoMs > 0
    ? { slowMo: slowMoMs }
    : undefined;

module.exports = defineConfig({
  testDir: './ui-smoke',
  timeout: 30 * 1000,
  retries: 0,
  fullyParallel: true,
  reporter: 'list',
  use: {
    headless: true,
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    launchOptions,
  },
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
  testMatch: ['**/*.spec.*'],
  testIgnore: [
    '**/page-objects/**',
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
