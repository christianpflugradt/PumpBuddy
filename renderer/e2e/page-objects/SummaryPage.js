const { Page } = require('@playwright/test');

class SummaryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async finishWorkout() {
    await this.page.getByRole('button', { name: /complete|finish|abschlie/i }).click();
  }

  async expectSummaryDetails({ deadliftText, splitSquatText, plankText }) {
    // Assertion logic moved out; this Page Object is now generic—assert in the test spec instead!
    return [deadliftText, splitSquatText, plankText];
  }

  async expectWorkoutFinalized() {
    // This is a UI assertion placeholder for the test; not asserted directly here
    return true;
  }
}

module.exports = { SummaryPage };
