import { Page, expect } from '@playwright/test';

export class GymPlanSelectPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async selectGymMode() {
    // Select the Gym Mode radio button
    const gymModeRadio = this.page.getByRole('radio', { name: /gym mode/i });
    await expect(gymModeRadio).toBeVisible({ timeout: 10000 });
    await gymModeRadio.check();
  }

  async selectGym(gymName: string) {
    // Wait for #gym-select to exist, be visible, and enabled
    await expect(this.page.locator('#gym-select')).toBeVisible({ timeout: 10000 });
    await expect(this.page.locator('#gym-select')).toBeEnabled({ timeout: 10000 });
    await this.page.locator('#gym-select').selectOption({ label: gymName });
  }

  async selectPlan(planName: string) {
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
