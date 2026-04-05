# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-hpp.spec.js >> UI smoke happy path > login, select plan/gym, complete workout and view summary
- Location: ui-smoke/zzz-hpp.spec.js:431:1

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
- region "Workout exercise step" [ref=e6]:
  - generic [ref=e7]:
    - heading "Deadlift" [level=2] [ref=e8]
    - paragraph [ref=e9]: Paused Barbell Deadlift
    - paragraph [ref=e10]: Leg Day at Downtown Dumbbell Den · 1/3
  - region "Exercise sets" [ref=e11]:
    - generic [ref=e12]:
      - heading "Current Set" [level=3] [ref=e13]
      - paragraph [ref=e14]: Set 1
    - list [ref=e15]:
      - listitem [ref=e16]:
        - generic [ref=e17]:
          - generic [ref=e18]:
            - generic [ref=e19]: Load
            - generic "Load controls" [ref=e20]:
              - button "-" [ref=e21] [cursor=pointer]
              - textbox "Exercise load in kilograms" [ref=e22]: "100"
              - button "+" [ref=e23] [cursor=pointer]
          - generic [ref=e24]:
            - generic [ref=e25]: Reps
            - generic "Reps controls" [ref=e26]:
              - button "-" [ref=e27] [cursor=pointer]
              - textbox "Exercise reps" [ref=e28]: "5"
              - button "+" [ref=e29] [cursor=pointer]
    - button "Complete Set" [ref=e30] [cursor=pointer]
    - region "Completed set history" [ref=e31]:
      - heading "History" [level=4] [ref=e32]
      - generic [ref=e33]:
        - generic [ref=e34]: Set
        - generic [ref=e35]: kg
        - generic [ref=e36]: reps
      - status [ref=e37]: No completed sets yet.
  - generic [ref=e39]:
    - button "Previous" [disabled] [ref=e40]
    - button "Next" [ref=e41] [cursor=pointer]
```

# Test source

```ts
  507 |       });
  508 |       return;
  509 |     }
  510 | 
  511 |     await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Method not allowed' }) });
  512 |   });
  513 | 
  514 |   await page.route('**/api/active-workout/**', async (route) => {
  515 |     const request = route.request();
  516 |     const url = request.url();
  517 | 
  518 |     if (request.method() === 'PUT') {
  519 |       const payload = request.postDataJSON();
  520 |       persistedWorkoutResponse = buildWorkoutResponse({
  521 |         payload,
  522 |         currentExercisePosition: payload.current_exercise_position,
  523 |       });
  524 |       await route.fulfill({
  525 |         status: 200,
  526 |         contentType: 'application/json',
  527 |         body: JSON.stringify(persistedWorkoutResponse),
  528 |       });
  529 |       return;
  530 |     }
  531 | 
  532 |     if (request.method() === 'POST' && url.endsWith('/complete')) {
  533 |       await route.fulfill({
  534 |         status: 200,
  535 |         contentType: 'application/json',
  536 |         body: JSON.stringify({
  537 |           id: 'workout-1',
  538 |           training_plan_id: 'plan-1',
  539 |           training_plan_name: 'Leg Day',
  540 |           gym_id: 'gym-2',
  541 |           gym_name: 'Downtown Dumbbell Den',
  542 |           started_at: STARTED_AT,
  543 |           completed_at: COMPLETED_AT,
  544 |           exercise_count: 3,
  545 |           completed_set_count: 4,
  546 |         }),
  547 |       });
  548 |       return;
  549 |     }
  550 | 
  551 |     if (request.method() === 'DELETE') {
  552 |       persistedWorkoutResponse = null;
  553 |       await route.fulfill({ status: 204, body: '' });
  554 |       return;
  555 |     }
  556 | 
  557 |     await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Method not allowed' }) });
  558 |   });
  559 | 
  560 |   await page.goto('/');
  561 | 
  562 |   await expect(page.getByRole('region', { name: 'Sign in' })).toBeVisible();
  563 |   await page.getByRole('textbox', { name: 'Access Key' }).fill('test-api-key');
  564 |   await clickWithMouse(page, page.getByRole('button', { name: 'Sign in' }));
  565 | 
  566 |   const startScreen = page.getByRole('region', { name: 'Workout start screen' });
  567 |   await expect(startScreen).toBeVisible();
  568 |   await expect(page.getByRole('alert')).toHaveCount(0);
  569 | 
  570 |   await clickWithMouse(page, page.getByLabel('Training Plan', { exact: true }));
  571 |   await page.getByLabel('Training Plan', { exact: true }).selectOption('plan-1');
  572 |   await clickWithMouse(page, page.getByLabel('Gym', { exact: true }));
  573 |   await page.getByLabel('Gym', { exact: true }).selectOption('gym-2');
  574 |   await expect(page.getByRole('button', { name: 'Start Workout' })).toBeEnabled();
  575 |   await clickWithMouse(page, page.getByRole('button', { name: 'Start Workout' }));
  576 | 
  577 |   await expect(page.getByRole('heading', { name: 'Deadlift' })).toBeVisible();
  578 |   const fallbackPanel = page.getByRole('region', { name: 'Fallback exercise option' });
  579 |   const completedSetHistory = page.getByLabel('Completed set history');
  580 |   await expect(fallbackPanel).toBeVisible();
  581 |   await expect(completedSetHistory).toHaveCount(0);
  582 |   await expect(page.locator('#exercise-load')).toHaveCount(0);
  583 |   await expect(page.locator('#exercise-reps')).toHaveCount(0);
  584 |   await clickWithMouse(page, page.locator('#fallback-option-select'));
  585 |   await page.locator('#fallback-option-select').selectOption(DEADLIFT_MIDDLE_OPTION_KEY);
  586 |   await clickWithMouse(page, page.getByRole('button', { name: 'Select' }));
  587 |   await expect(fallbackPanel).toHaveCount(0);
  588 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'empty');
  589 |   await expect(page.locator('#exercise-load')).toBeVisible();
  590 |   await expect(page.locator('#exercise-reps')).toBeVisible();
  591 |   await expect(page.locator('.exercise-variant-label')).toContainText(DEADLIFT_MIDDLE_OPTION.variant_name);
  592 |   await setNumericInputViaButtons({
  593 |     page,
  594 |     inputSelector: '#exercise-load',
  595 |     incrementAction: 'increment-load',
  596 |     decrementAction: 'decrement-load',
  597 |     target: 100,
  598 |   });
  599 |   await setNumericInputViaButtons({
  600 |     page,
  601 |     inputSelector: '#exercise-reps',
  602 |     incrementAction: 'increment-reps',
  603 |     decrementAction: 'decrement-reps',
  604 |     target: 5,
  605 |   });
  606 |   await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
> 607 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
      |                                     ^ Error: expect(locator).toHaveAttribute(expected) failed
  608 |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  609 |   await expect(completedSetHistory.locator('.completed-set-row').first()).toContainText('100 kg');
  610 |   await expect(completedSetHistory.locator('.completed-set-row').first()).toContainText('5');
  611 |   await clickWithMouse(page, page.getByRole('button', { name: 'Next' }));
  612 | 
  613 |   await expect(page.getByRole('heading', { name: 'Bulgarian Split Squat' })).toBeVisible();
  614 |   await expect(page.locator('.set-row-field-label', { hasText: 'Load per Side' })).toBeVisible();
  615 |   await setNumericInputViaButtons({
  616 |     page,
  617 |     inputSelector: '#exercise-load',
  618 |     incrementAction: 'increment-load',
  619 |     decrementAction: 'decrement-load',
  620 |     target: 24,
  621 |   });
  622 |   await setNumericInputViaButtons({
  623 |     page,
  624 |     inputSelector: '#exercise-reps',
  625 |     incrementAction: 'increment-reps',
  626 |     decrementAction: 'decrement-reps',
  627 |     target: 8,
  628 |   });
  629 |   await clickWithMouse(page, page.getByRole('button', { name: 'Complete Left Side' }));
  630 |   await expect(page.getByRole('button', { name: 'Complete Set' })).toBeVisible();
  631 |   await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
  632 |   const unilateralHistoryRow = completedSetHistory.locator('.completed-set-row').first();
  633 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  634 |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  635 |   await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /left .* kg for 8 reps/);
  636 |   await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /right .* kg for 8 reps/);
  637 |   await clickWithMouse(page, page.getByRole('button', { name: 'Next' }));
  638 | 
  639 |   await expect(page.getByRole('heading', { name: 'Plank' })).toBeVisible();
  640 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'empty');
  641 |   await setSecsViaPicker({ page, minutes: 0, seconds: 45 });
  642 |   await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
  643 |   const secsHistoryRow = completedSetHistory.locator('.completed-set-row').first();
  644 |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  645 |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  646 |   await expect(secsHistoryRow).toHaveAttribute('aria-label', /45 reps/);
  647 |   await expect(secsHistoryRow).toContainText('45');
  648 | 
  649 |   await clickWithMouse(page, page.getByRole('button', { name: 'Finish Workout' }));
  650 | 
  651 |   await expect(page.getByRole('region', { name: 'Workout completion screen' })).toBeVisible();
  652 |   await expect(page.getByRole('heading', { name: 'Plan Completed' })).toBeVisible();
  653 |   await expect(page.getByLabel('Workout completion metrics')).toContainText('Exercises Completed');
  654 |   await expect(page.getByLabel('Workout completion metrics')).toContainText('3');
  655 | });
  656 | 
```