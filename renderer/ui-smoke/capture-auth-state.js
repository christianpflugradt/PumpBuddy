const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  // Go through the login UI
  await page.goto('http://localhost:5173/login');
  await page.fill('input[type="text"]', 'test-api-key');
  await page.click('button, [type=submit]');
  // Wait for something that only exists after login
  await page.waitForURL('**/workout/start', {timeout: 10000}); // or tweak selector for your UI
  await context.storageState({ path: 'auth.json' });
  await browser.close();
})();
