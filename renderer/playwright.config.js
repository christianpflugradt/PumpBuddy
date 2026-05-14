const { defineConfig, devices } = require('@playwright/test');

const slowMoMs = Number.parseInt(process.env.PW_SLOWMO ?? '', 10);
const launchOptions =
  Number.isFinite(slowMoMs) && slowMoMs > 0
    ? { slowMo: slowMoMs }
    : undefined;
const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '41733';
const playwrightBaseUrl = `http://localhost:${playwrightPort}`;

module.exports = defineConfig({
  testDir: './ui-smoke',
  timeout: 45 * 1000,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: false,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  expect: {
    timeout: 10 * 1000,
  },
  use: {
    headless: true,
    baseURL: playwrightBaseUrl,
    trace: 'on-first-retry',
    actionTimeout: 12 * 1000,
    navigationTimeout: 20 * 1000,
    launchOptions,
  },
  webServer: {
    command: `npm run start -- --port ${playwrightPort}`,
    url: playwrightBaseUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 240 * 1000,
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
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          ...launchOptions,
          firefoxUserPrefs: {
            'ui.prefersReducedMotion': 1,
          },
        },
      },
      retries: process.env.CI ? 2 : 0,
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
