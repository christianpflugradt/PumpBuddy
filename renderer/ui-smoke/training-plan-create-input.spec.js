const { test, expect } = require('@playwright/test');

test('Training Plan creation keeps keyboard focus and caret through name and picker searches', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const screen = document.createElement('pb-configurator-training-plans-screen');
    screen.state = {
      mode: 'list', trainingPlans: [], isLoading: false, errorMessage: null,
      exercises: [
        { id: 'bench', name: 'Bench press', variants: [
          { id: 'barbell', name: 'Barbell' }, { id: 'dumbbell', name: 'Dumbbell' },
        ] },
        { id: 'squat', name: 'Squat', variants: [{ id: 'back-squat', name: 'Back squat' }] },
      ],
    };
    document.body.append(screen);
  });

  const screen = page.locator('pb-configurator-training-plans-screen');
  await screen.getByRole('button', { name: 'New Training Plan' }).click();
  const typeAndCheck = async (role, text) => {
    const input = screen.locator(`[data-role="${role}"]`);
    await input.pressSequentially(text);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue(text);
    expect(await input.evaluate((element) => element.selectionStart)).toBe(text.length);
  };

  await typeAndCheck('plan-name', 'Upper');
  await screen.locator('[data-ui-action="open-create-plan-exercise-picker"]').click();
  await typeAndCheck('exercise-search', 'bench');
  await expect(screen.getByRole('listbox', { name: 'Available Exercises' })).toContainText('Bench press');
  await expect(screen.getByRole('listbox', { name: 'Available Exercises' })).not.toContainText('Squat');
  await screen.locator('[data-ui-action="select-create-plan-exercise"][data-exercise-id="bench"]').click();
  await screen.locator('[data-ui-action="open-create-plan-variant-picker"]').click();
  await typeAndCheck('variant-search', 'barbell');
  await expect(screen.getByRole('listbox', { name: 'Available Variants' })).toContainText('Barbell');
  await expect(screen.getByRole('listbox', { name: 'Available Variants' })).not.toContainText('Dumbbell');
});
