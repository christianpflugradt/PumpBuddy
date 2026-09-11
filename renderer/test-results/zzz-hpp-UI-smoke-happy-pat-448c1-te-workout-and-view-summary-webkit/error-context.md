# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-hpp.spec.js >> UI smoke happy path > login, select plan/gym, complete workout and view summary
- Location: ui-smoke/zzz-hpp.spec.js:675:1

# Error details

```
Error: expect(locator).toHaveAttribute(expected) failed

Locator: getByLabel('Completed set history').locator('.completed-set-row').first()
Expected pattern: /right .* kg for 8 reps/
Received string:  "Completed set 1: left 48 kg for 8 reps, right side pending"
Timeout: 10000ms

Call log:
  - Expect "toHaveAttribute" with timeout 10000ms
  - waiting for getByLabel('Completed set history').locator('.completed-set-row').first()
    24 × locator resolved to <li class="completed-set-row completed-set-grid--unilateral" aria-label="Completed set 1: left 48 kg for 8 reps, right side pending">…</li>
       - unexpected value "Completed set 1: left 48 kg for 8 reps, right side pending"

```

```yaml
- 'listitem "Completed set 1: left 48 kg for 8 reps, right side pending"':
  - text: 1 48 kg 8
  - button "Delete set 1"
```

# Test source

```ts
  868  |         await route.fulfill({
  869  |           status: 404,
  870  |           contentType: 'application/json',
  871  |           body: JSON.stringify({ message: 'No active workout' }),
  872  |         });
  873  |         return;
  874  |       }
  875  | 
  876  |       await route.fulfill({
  877  |         status: 200,
  878  |         contentType: 'application/json',
  879  |         body: JSON.stringify(persistedWorkoutResponse),
  880  |       });
  881  |       return;
  882  |     }
  883  | 
  884  |     if (request.method() === 'DELETE') {
  885  |       persistedWorkoutResponse = null;
  886  |       await route.fulfill({ status: 204, body: '' });
  887  |       return;
  888  |     }
  889  | 
  890  |     await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Method not allowed' }) });
  891  |   });
  892  | 
  893  |   await page.goto('/');
  894  | 
  895  |   await expect(page.getByRole('region', { name: 'Sign in' })).toBeVisible();
  896  |   await page.getByRole('textbox', { name: 'Login' }).fill(testLogin);
  897  |   await page.getByLabel('Password', { exact: true }).fill('test-api-key');
  898  |   await clickWithMouse(page, page.getByRole('button', { name: 'Sign in' }));
  899  | 
  900  |   const startScreen = page.getByRole('region', { name: 'Workout start screen' });
  901  |   await expect(startScreen).toBeVisible();
  902  |   await expect(page.getByRole('alert')).toHaveCount(0);
  903  | 
  904  |   await clickWithMouse(page, page.getByLabel('Training Plan', { exact: true }));
  905  |   await page.getByLabel('Training Plan', { exact: true }).selectOption('plan-1');
  906  |   await clickWithMouse(page, page.getByLabel('Gym', { exact: true }));
  907  |   await page.getByLabel('Gym', { exact: true }).selectOption('gym-2');
  908  |   await expect(page.getByRole('button', { name: 'Start Workout' })).toBeEnabled();
  909  |   await clickWithMouse(page, page.getByRole('button', { name: 'Start Workout' }));
  910  | 
  911  |   await expect(page.getByRole('heading', { name: 'Deadlift' })).toBeVisible();
  912  |   const fallbackPanel = page.getByRole('region', { name: 'Fallback exercise option' });
  913  |   const completedSetHistory = page.getByLabel('Completed set history');
  914  |   await expect(fallbackPanel).toBeVisible();
  915  |   await expect(completedSetHistory).toHaveCount(0);
  916  |   await expect(page.locator('#exercise-load')).toHaveCount(0);
  917  |   await expect(page.locator('#exercise-reps')).toHaveCount(0);
  918  |   await clickWithMouse(page, page.locator('#fallback-option-select'));
  919  |   await page.locator('#fallback-option-select').selectOption(DEADLIFT_MIDDLE_OPTION_KEY);
  920  |   await clickWithMouse(page, page.getByRole('button', { name: 'Select' }));
  921  |   await expect(fallbackPanel).toHaveCount(0);
  922  |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'empty');
  923  |   await expect(page.locator('#exercise-load')).toBeVisible();
  924  |   await expect(page.locator('#exercise-reps')).toBeVisible();
  925  |   await expect(page.locator('.exercise-variant-label')).toContainText(DEADLIFT_MIDDLE_OPTION.variant_name);
  926  |   await setNumericInputViaButtons({
  927  |     page,
  928  |     inputSelector: '#exercise-load',
  929  |     incrementAction: 'increment-load',
  930  |     decrementAction: 'decrement-load',
  931  |     target: 100,
  932  |   });
  933  |   await setNumericInputViaButtons({
  934  |     page,
  935  |     inputSelector: '#exercise-reps',
  936  |     incrementAction: 'increment-reps',
  937  |     decrementAction: 'decrement-reps',
  938  |     target: 5,
  939  |   });
  940  |   await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
  941  |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  942  |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  943  |   await expect(completedSetHistory.locator('.completed-set-row').first()).toContainText('100 kg');
  944  |   await expect(completedSetHistory.locator('.completed-set-row').first()).toContainText('5');
  945  |   await clickWithMouse(page, page.getByRole('button', { name: 'Next' }));
  946  | 
  947  |   await expect(page.getByRole('heading', { name: 'Bulgarian Split Squat' })).toBeVisible();
  948  |   await expect(page.locator('.set-row-field-label', { hasText: 'Load per Side' })).toBeVisible();
  949  |   await setNumericInputViaButtons({
  950  |     page,
  951  |     inputSelector: '#exercise-load',
  952  |     incrementAction: 'increment-load',
  953  |     decrementAction: 'decrement-load',
  954  |     target: 24,
  955  |   });
  956  |   await setNumericInputViaButtons({
  957  |     page,
  958  |     inputSelector: '#exercise-reps',
  959  |     incrementAction: 'increment-reps',
  960  |     decrementAction: 'decrement-reps',
  961  |     target: 8,
  962  |   });
  963  |   await completeUnilateralSet(page);
  964  |   const unilateralHistoryRow = completedSetHistory.locator('.completed-set-row').first();
  965  |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  966  |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  967  |   await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /left .* kg for 8 reps/);
> 968  |   await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /right .* kg for 8 reps/);
       |                                      ^ Error: expect(locator).toHaveAttribute(expected) failed
  969  |   await clickWithMouse(page, page.getByRole('button', { name: 'Next' }));
  970  | 
  971  |   await expect(page.getByRole('heading', { name: 'Plank' })).toBeVisible();
  972  |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'empty');
  973  |   await setSecsViaPicker({ page, minutes: 0, seconds: 45 });
  974  |   await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
  975  |   const secsHistoryRow = completedSetHistory.locator('.completed-set-row').first();
  976  |   await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  977  |   await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  978  |   await expect(secsHistoryRow).toHaveAttribute('aria-label', /0:45/);
  979  |   await expect(secsHistoryRow).not.toHaveAttribute('aria-label', /reps/);
  980  |   await expect(secsHistoryRow).toContainText('0:45');
  981  | 
  982  |   await clickWithMouse(page, page.getByRole('button', { name: 'Finish Workout' }));
  983  | 
  984  |   await expect(page.getByRole('region', { name: 'Workout completion screen' })).toBeVisible();
  985  |   await expect(page.getByRole('heading', { name: 'Completed' })).toBeVisible();
  986  |   await expect(page.getByLabel('Workout completion metrics')).toHaveCount(0);
  987  | });
  988  | 
  989  | test('UI smoke configurator exercises > navigation, search, lifecycle, loading, and error states', async ({ page }) => {
  990  |   let isLoggedIn = false;
  991  |   let holdNextExerciseResponse = false;
  992  |   let failNextExerciseResponse = false;
  993  |   let releaseSecondExerciseRequest;
  994  |   await page.route('**/auth/session', async (route) => {
  995  |     await route.fulfill({
  996  |       status: isLoggedIn ? 200 : 401,
  997  |       contentType: 'application/json',
  998  |       body: isLoggedIn ? JSON.stringify({ user: { name: 'Dev User' } }) : '{}',
  999  |     });
  1000 |   });
  1001 |   await page.route('**/auth/login', async (route) => {
  1002 |     isLoggedIn = true;
  1003 |     await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  1004 |   });
  1005 |   await page.route('**/api/training-plans', async (route) => {
  1006 |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  1007 |   });
  1008 |   await page.route('**/api/gyms', async (route) => {
  1009 |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  1010 |   });
  1011 |   await page.route('**/api/load-profiles', async (route) => {
  1012 |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  1013 |   });
  1014 |   await page.route('**/api/exercises', async (route) => {
  1015 |     if (holdNextExerciseResponse) {
  1016 |       holdNextExerciseResponse = false;
  1017 |       await new Promise((resolve) => {
  1018 |         releaseSecondExerciseRequest = resolve;
  1019 |       });
  1020 |     }
  1021 |     if (failNextExerciseResponse) {
  1022 |       failNextExerciseResponse = false;
  1023 |       await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) });
  1024 |       return;
  1025 |     }
  1026 |     await route.fulfill({
  1027 |       status: 200,
  1028 |       contentType: 'application/json',
  1029 |       body: JSON.stringify([
  1030 |         { id: 'exercise-active', name: 'Barbell Squat', status: 'active', variant_count: 2 },
  1031 |         { id: 'exercise-inactive', name: 'Retired Curl', status: 'inactive', variant_count: 1 },
  1032 |       ]),
  1033 |     });
  1034 |   });
  1035 | 
  1036 |   const signInAndOpenExercises = async () => {
  1037 |     await page.goto('/');
  1038 |     await page.getByLabel('Login').fill('main');
  1039 |     await page.getByLabel('Password', { exact: true }).fill('test-api-key');
  1040 |     await page.getByRole('button', { name: 'Sign in' }).click();
  1041 |     await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1042 |     await page.getByRole('button', { name: 'Configurator' }).click();
  1043 |     await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1044 |     await page.getByRole('button', { name: 'Exercises' }).click();
  1045 |   };
  1046 | 
  1047 |   await signInAndOpenExercises();
  1048 |   const screen = page.getByRole('region', { name: 'Configurator exercises screen' });
  1049 |   await expect(screen).toBeVisible();
  1050 |   await expect(screen).toContainText('Barbell Squat');
  1051 |   await expect(screen).toContainText('Active');
  1052 |   await expect(screen.locator('.configurator-exercise-card--inactive')).toContainText('Retired Curl');
  1053 |   await expect(page.getByRole('button', { name: 'Variants' })).toHaveCount(0);
  1054 |   await screen.getByRole('searchbox', { name: 'Search exercises' }).fill('retired');
  1055 |   await expect(screen).toContainText('Retired Curl');
  1056 |   await expect(screen).not.toContainText('Barbell Squat');
  1057 | 
  1058 |   holdNextExerciseResponse = true;
  1059 |   await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1060 |   await page.getByRole('button', { name: 'Load Profiles' }).click();
  1061 |   await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1062 |   await page.getByRole('button', { name: 'Exercises' }).click();
  1063 |   await expect(screen).toContainText('Loading exercises...');
  1064 |   releaseSecondExerciseRequest();
  1065 |   await expect(screen).toContainText('Barbell Squat');
  1066 | 
  1067 |   failNextExerciseResponse = true;
  1068 |   await page.getByRole('button', { name: 'Open navigation menu' }).click();
```