const { Page, expect } = require('@playwright/test');

class GymPlanSelectPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async selectGymMode() {
    // Select the Gym Mode radio button
    const gymModeRadio = this.page.getByRole('radio', { name: /gym mode/i });
    await expect(gymModeRadio).toBeVisible({ timeout: 10000 });
    await gymModeRadio.check();
  }

  async selectGym(gymName) {
    // Wait for #gym-select to exist, be visible, and enabled
    await expect(this.page.locator('#gym-select')).toBeVisible({ timeout: 10000 });
    await expect(this.page.locator('#gym-select')).toBeEnabled({ timeout: 10000 });
    await this.page.locator('#gym-select').selectOption({ label: gymName });
  }

  async selectPlan(planName) {
    const planSelect = this.page.getByLabel(/plan/i);
    await expect(planSelect).toBeVisible({ timeout: 10000 });
    await expect(planSelect).toBeEnabled({ timeout: 10000 });
    await planSelect.selectOption({ label: planName });
  }

  async startWorkout() {
    await this.page.getByRole('button', { name: /start workout|workout.*begin/i }).click();
  }

  async expectStartScreenVisible() {
    await this.page.getByRole('region', { name: /workout start screen|workout summary/i }).isVisible();
  }
}

module.exports = { GymPlanSelectPage };
