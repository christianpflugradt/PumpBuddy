# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-hpp.spec.js >> UI smoke happy path > login, select plan/gym, complete workout and view summary
- Location: ui-smoke/zzz-hpp.spec.js:459:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator:  getByLabel('Completed set history')
Expected: "populated"
Received: "empty"
Timeout:  5000ms

Call log:
  - Expect "toHaveAttribute" with timeout 5000ms
  - waiting for getByLabel('Completed set history')
    9 × locator resolved to <section class="completed-set-list" data-history-state="empty" aria-label="Completed set history">…</section>
      - unexpected value "empty"

```

# Page snapshot

```yaml
- region "Workout exercise step" [ref=e7]:
  - generic [ref=e8]:
    - heading "Deadlift" [level=2] [ref=e9]
    - paragraph [ref=e10]: Paused Barbell Deadlift
    - paragraph [ref=e11]: Leg Day at Downtown Dumbbell Den · 1/3
  - region "Exercise sets" [ref=e12]:
    - generic [ref=e13]:
      - heading "Current Set" [level=3] [ref=e14]
      - paragraph [ref=e15]: Set 1
    - list [ref=e16]:
      - listitem [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]:
            - generic [ref=e20]: Load
            - generic "Load controls" [ref=e21]:
              - button "-" [ref=e22] [cursor=pointer]
              - textbox "Exercise load in kilograms" [ref=e23]: "100"
              - button "+" [ref=e24] [cursor=pointer]
          - generic [ref=e25]:
            - generic [ref=e26]: REPS
            - generic "Reps controls" [ref=e27]:
              - button "-" [ref=e28] [cursor=pointer]
              - textbox "Exercise reps" [ref=e29]: "5"
              - button "+" [ref=e30] [cursor=pointer]
    - button "Complete Set" [ref=e31] [cursor=pointer]
    - region "Completed set history" [ref=e32]:
      - heading "History" [level=4] [ref=e33]
      - generic [ref=e34]:
        - generic [ref=e35]: Set
        - generic [ref=e36]: kg
        - generic [ref=e37]: reps
      - status [ref=e38]: No completed sets yet.
  - generic [ref=e40]:
    - button "Previous" [disabled] [ref=e41]
    - button "Next" [ref=e42] [cursor=pointer]
```

# Test source

```ts
  536 |       return;
  537 |     }
  538 | 
  539 |     await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Method not allowed' }) });
  540 |   });
  541 | 
  542 |   await page.route('**/api/active-workout/**', async (route) => {
  543 |     const request = route.request();
  544 |     const url = request.url();
  545 | 
  546 |     if (request.method() === 'PUT') {
  547 |       const payload = request.postDataJSON();
  548 |       persistedWorkoutResponse = buildWorkoutResponse({
  549 |         payload,
  550 |         currentExercisePosition: payload.current_exercise_position,
  551 |       });
  552 |       await route.fulfill({
  553 |         status: 200,
  554 |         contentType: 'application/json',
  555 |         body: JSON.stringify(persistedWorkoutResponse),
  556 |       });
  557 |       return;
  558 |     }
  559 | 
  560 |     if (request.method() === 'POST' && url.endsWith('/complete')) {
  561 |       await route.fulfill({
  562 |         status: 200,
  563 |         contentType: 'application/json',
  564 |         body: JSON.stringify({
  565 |           id: 'workout-1',
  566 |           training_plan_id: 'plan-1',
  567 |           training_plan_name: 'Leg Day',
  568 |           gym_id: 'gym-2',
  569 |           gym_name: 'Downtown Dumbbell Den',
  570 |           started_at: STARTED_AT,
  571 |           completed_at: COMPLETED_AT,
  572 |           exercise_count: 3,
  573 |           completed_set_count: 4,
  574 |         }),
  575 |       });
  576 |       return;
  577 |     }
  578 | 
  579 |     if (request.method() === 'DELETE') {
  580 |       persistedWorkoutResponse = null;
  581 |       await route.fulfill({ status: 204, body: '' });
  582 |       return;
  583 |     }
  584 | 
  585 |     await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Method not allowed' }) });
  586 |   });
  587 | 
  588 |   await page.goto('/');
  589 | 
  590 |   await expect(page.getByRole('region', { name: 'Sign in' })).toBeVisible();
  591 |   await page.getByRole('textbox', { name: 'Login' }).fill('');
  592 |   await page.getByLabel('Password', { exact: true }).fill('test-api-key');
  593 |   await clickWithMouse(page, page.getByRole('button', { name: 'Sign in' }));
  594 | 
  595 |   const startScreen = page.getByRole('region', { name: 'Workout start screen' });
  596 |   await expect(startScreen).toBeVisible();
  597 |   await expect(page.getByRole('alert')).toHaveCount(0);
  598 | 
  599 |   await clickWithMouse(page, page.getByLabel('Training Plan', { exact: true }));
  600 |   await page.getByLabel('Training Plan', { exact: true }).selectOption('plan-1');
  601 |   await clickWithMouse(page, page.getByLabel('Gym', { exact: true }));
  602 |   await page.getByLabel('Gym', { exact: true }).selectOption('gym-2');
  603 |   await expect(page.getByRole('button', { name: 'Start Workout' })).toBeEnabled();
  604 |   await clickWithMouse(page, page.getByRole('button', { name: 'Start Workout' }));
  605 | 
  606 |   await expect(page.getByRole('heading', { name: 'Deadlift' })).toBeVisible();
  607 |   const fallbackPanel = page.getByRole('region', { name: 'Fallback exercise option' });
  608 |   const completedSetHistory = page.getByLabel('Completed set history');
  609 |   await expect(fallbackPanel).toBeVisible();
  610 |   await expect(completedSetHistory).toHaveCount(0);
  611 |   await expect(page.locator('#exercise-load')).toHaveCount(0);
  612 |   await expect(page.locator('#exercise-reps')).toHaveCount(0);
  613 |   await clickWithMouse(page, page.locator('#fallback-option-select'));
  614 |   await page.locator('#fallback-option-select').selectOption(DEADLIFT_MIDDLE_OPTION_KEY);
  615 |   await clickWithMouse(page, page.getByRole('button', { name: 'Select' }));
  616 |   await expect(fallbackPanel).toHaveCount(0);
  617 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'empty');
  618 |   await expect(page.locator('#exercise-load')).toBeVisible();
  619 |   await expect(page.locator('#exercise-reps')).toBeVisible();
  620 |   await expect(page.locator('.exercise-variant-label')).toContainText(DEADLIFT_MIDDLE_OPTION.variant_name);
  621 |   await setNumericInputViaButtons({
  622 |     page,
  623 |     inputSelector: '#exercise-load',
  624 |     incrementAction: 'increment-load',
  625 |     decrementAction: 'decrement-load',
  626 |     target: 100,
  627 |   });
  628 |   await setNumericInputViaButtons({
  629 |     page,
  630 |     inputSelector: '#exercise-reps',
  631 |     incrementAction: 'increment-reps',
  632 |     decrementAction: 'decrement-reps',
  633 |     target: 5,
  634 |   });
  635 |   await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
> 636 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
      |                                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  637 |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  638 |   await expect(completedSetHistory.locator('.completed-set-row').first()).toContainText('100 kg');
  639 |   await expect(completedSetHistory.locator('.completed-set-row').first()).toContainText('5');
  640 |   await clickWithMouse(page, page.getByRole('button', { name: 'Next' }));
  641 | 
  642 |   await expect(page.getByRole('heading', { name: 'Bulgarian Split Squat' })).toBeVisible();
  643 |   await expect(page.locator('.set-row-field-label', { hasText: 'Load per Side' })).toBeVisible();
  644 |   await setNumericInputViaButtons({
  645 |     page,
  646 |     inputSelector: '#exercise-load',
  647 |     incrementAction: 'increment-load',
  648 |     decrementAction: 'decrement-load',
  649 |     target: 24,
  650 |   });
  651 |   await setNumericInputViaButtons({
  652 |     page,
  653 |     inputSelector: '#exercise-reps',
  654 |     incrementAction: 'increment-reps',
  655 |     decrementAction: 'decrement-reps',
  656 |     target: 8,
  657 |   });
  658 |   await completeUnilateralSet(page);
  659 |   const unilateralHistoryRow = completedSetHistory.locator('.completed-set-row').first();
  660 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  661 |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  662 |   await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /left .* kg for 8 reps/);
  663 |   await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /right .* kg for 8 reps/);
  664 |   await clickWithMouse(page, page.getByRole('button', { name: 'Next' }));
  665 | 
  666 |   await expect(page.getByRole('heading', { name: 'Plank' })).toBeVisible();
  667 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'empty');
  668 |   await setSecsViaPicker({ page, minutes: 0, seconds: 45 });
  669 |   await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
  670 |   const secsHistoryRow = completedSetHistory.locator('.completed-set-row').first();
  671 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  672 |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  673 |   await expect(secsHistoryRow).toHaveAttribute('aria-label', /45 reps/);
  674 |   await expect(secsHistoryRow).toContainText('45');
  675 | 
  676 |   await clickWithMouse(page, page.getByRole('button', { name: 'Finish Workout' }));
  677 | 
  678 |   await expect(page.getByRole('region', { name: 'Workout completion screen' })).toBeVisible();
  679 |   await expect(page.getByRole('heading', { name: 'Plan Completed' })).toBeVisible();
  680 |   await expect(page.getByLabel('Workout completion metrics')).toContainText('Exercises Completed');
  681 |   await expect(page.getByLabel('Workout completion metrics')).toContainText('3');
  682 | });
  683 | 
```