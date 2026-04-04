import { Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/');
  }

  async enterApiKeyAndContinue(apiKey: string) {
    await this.page.getByLabel(/access key/i).fill(apiKey);
    await this.page.getByRole('button', { name: /continue|submit|sign in|weiter|next/i }).click();
  }

  async expectGymPlanSelectVisible() {
    await this.page.getByRole('region', { name: /gym.*plan.*auswahl|gym.*selection|plan.*selection/i }).isVisible();
  }
}
