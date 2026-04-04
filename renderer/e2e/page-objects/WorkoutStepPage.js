const { Page } = require('@playwright/test');

class WorkoutStepPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async selectOption(station, variant) {
    if (station) {
      await this.page.getByLabel(/station/i).selectOption({ label: station });
    }
    if (variant) {
      await this.page.getByLabel(/variant|exercise option/i).selectOption({ label: variant });
    }
  }

  async fillSet({ reps, load, seconds }) {
    if (typeof reps === 'number') {
      await this.page.getByLabel(/reps|repetitions/i).fill(''+reps);
    }
    if (typeof load === 'number') {
      await this.page.getByLabel(/load|weight/i).fill(''+load);
    }
    if (typeof seconds === 'number') {
      await this.page.getByLabel(/seconds|duration|timer/i).fill(''+seconds);
    }
  }

  async confirmSet() {
    await this.page.getByRole('button', { name: /confirm.*set|fertig|absenden/i }).click();
  }

  async getSetHistoryText() {
    return (await this.page.getByRole('region', { name: /set history|verlauf/i }).innerText());
  }

  async isProgressBarComplete() {
    const value = await this.page.getByRole('progressbar').getAttribute('aria-valuenow');
    return value === '100';
  }
}

module.exports = { WorkoutStepPage };
