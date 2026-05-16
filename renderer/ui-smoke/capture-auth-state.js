const { chromium } = require('playwright');

const playwrightPort = process.env.PLAYWRIGHT_PORT ?? '41733';
const playwrightBaseUrl = `http://localhost:${playwrightPort}`;
const testLogin = 'main';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  // Go through the login UI
  await page.goto(`${playwrightBaseUrl}/login`);
  await page.fill('input#login', testLogin);
  await page.fill('input#password', 'test-api-key');
  await page.click('button, [type=submit]');
  // Wait for something that only exists after login
  await page.waitForURL('**/workout/start', {timeout: 10000}); // or tweak selector for your UI
  await context.storageState({ path: 'auth.json' });
  await browser.close();
})();
