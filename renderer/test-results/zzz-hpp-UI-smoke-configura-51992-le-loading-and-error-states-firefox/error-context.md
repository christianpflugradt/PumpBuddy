# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-hpp.spec.js >> UI smoke configurator exercises > navigation, search, lifecycle, loading, and error states
- Location: ui-smoke/zzz-hpp.spec.js:989:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Configurator exercises screen' })
Expected substring: "Loading exercises..."
Received string:    "ExercisesManage the canonical movements and their variants.+ New ExerciseUnable to load exercises right now."
Timeout: 10000ms

Call log:
  - Expect "toContainText" with timeout 10000ms
  - waiting for getByRole('region', { name: 'Configurator exercises screen' })
    24 × locator resolved to <section aria-label="Configurator exercises screen" class="screen-panel configurator-exercises-screen">…</section>
       - unexpected value "ExercisesManage the canonical movements and their variants.+ New ExerciseUnable to load exercises right now."

```

```yaml
- region "Configurator exercises screen":
  - heading "Exercises" [level=1]
  - paragraph: Manage the canonical movements and their variants.
  - button "+ New Exercise"
  - searchbox "Search exercises"
  - alert: Unable to load exercises right now.
```

# Test source

```ts
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
  968  |   await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /right .* kg for 8 reps/);
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
  991  |   let exerciseRequestCount = 0;
  992  |   await page.route('**/auth/session', async (route) => {
  993  |     await route.fulfill({
  994  |       status: isLoggedIn ? 200 : 401,
  995  |       contentType: 'application/json',
  996  |       body: isLoggedIn ? JSON.stringify({ user: { name: 'Dev User' } }) : '{}',
  997  |     });
  998  |   });
  999  |   await page.route('**/auth/login', async (route) => {
  1000 |     isLoggedIn = true;
  1001 |     await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  1002 |   });
  1003 |   await page.route('**/api/training-plans', async (route) => {
  1004 |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  1005 |   });
  1006 |   await page.route('**/api/gyms', async (route) => {
  1007 |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  1008 |   });
  1009 |   await page.route('**/api/load-profiles', async (route) => {
  1010 |     await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  1011 |   });
  1012 |   await page.route('**/api/exercises', async (route) => {
  1013 |     exerciseRequestCount += 1;
  1014 |     if (exerciseRequestCount === 2) {
  1015 |       await new Promise((resolve) => setTimeout(resolve, 250));
  1016 |     }
  1017 |     if (exerciseRequestCount >= 3) {
  1018 |       await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unavailable' }) });
  1019 |       return;
  1020 |     }
  1021 |     await route.fulfill({
  1022 |       status: 200,
  1023 |       contentType: 'application/json',
  1024 |       body: JSON.stringify([
  1025 |         { id: 'exercise-active', name: 'Barbell Squat', status: 'active', variant_count: 2 },
  1026 |         { id: 'exercise-inactive', name: 'Retired Curl', status: 'inactive', variant_count: 1 },
  1027 |       ]),
  1028 |     });
  1029 |   });
  1030 | 
  1031 |   const signInAndOpenExercises = async () => {
  1032 |     await page.goto('/');
  1033 |     await page.getByLabel('Login').fill('main');
  1034 |     await page.getByLabel('Password', { exact: true }).fill('test-api-key');
  1035 |     await page.getByRole('button', { name: 'Sign in' }).click();
  1036 |     await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1037 |     await page.getByRole('button', { name: 'Configurator' }).click();
  1038 |     await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1039 |     await page.getByRole('button', { name: 'Exercises' }).click();
  1040 |   };
  1041 | 
  1042 |   await signInAndOpenExercises();
  1043 |   const screen = page.getByRole('region', { name: 'Configurator exercises screen' });
  1044 |   await expect(screen).toBeVisible();
  1045 |   await expect(screen).toContainText('Barbell Squat');
  1046 |   await expect(screen).toContainText('Active');
  1047 |   await expect(screen.locator('.configurator-exercise-card--inactive')).toContainText('Retired Curl');
  1048 |   await expect(page.getByRole('button', { name: 'Variants' })).toHaveCount(0);
  1049 |   await screen.getByRole('searchbox', { name: 'Search exercises' }).fill('retired');
  1050 |   await expect(screen).toContainText('Retired Curl');
  1051 |   await expect(screen).not.toContainText('Barbell Squat');
  1052 | 
  1053 |   await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1054 |   await page.getByRole('button', { name: 'Load Profiles' }).click();
  1055 |   await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1056 |   await page.getByRole('button', { name: 'Exercises' }).click();
> 1057 |   await expect(screen).toContainText('Loading exercises...');
       |                        ^ Error: expect(locator).toContainText(expected) failed
  1058 |   await expect(screen).toContainText('Barbell Squat');
  1059 | 
  1060 |   await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1061 |   await page.getByRole('button', { name: 'Load Profiles' }).click();
  1062 |   await page.getByRole('button', { name: 'Open navigation menu' }).click();
  1063 |   await page.getByRole('button', { name: 'Exercises' }).click();
  1064 |   await expect(screen).toContainText('Unable to load exercises right now.');
  1065 | });
  1066 | 
```