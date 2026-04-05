# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: zzz-hpp.spec.js >> UI smoke happy path > login, select plan/gym, complete workout and view summary
- Location: ui-smoke/zzz-hpp.spec.js:417:1

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Test timeout of 120000ms exceeded while running "afterEach" hook.
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | const fs = require('node:fs/promises');
  3   | const path = require('node:path');
  4   | 
  5   | const slowMoFromEnv = Number.parseInt(process.env.PW_SLOWMO ?? '', 10);
  6   | const isSlowMoRun = Number.isFinite(slowMoFromEnv) && slowMoFromEnv > 0;
  7   | 
  8   | const uiSmokeCoverageEnabled = process.env.UI_SMOKE_COVERAGE === '1';
  9   | const uiSmokeCoverageDir = path.resolve(__dirname, '..', 'coverage', 'ui-smoke');
  10  | 
  11  | const sanitizeName = (name) => name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
  12  | 
> 13  | test.afterEach(async ({ page }, testInfo) => {
      |      ^ Test timeout of 120000ms exceeded while running "afterEach" hook.
  14  |   if (!uiSmokeCoverageEnabled) {
  15  |     return;
  16  |   }
  17  | 
  18  |   const browserCoverage = await page
  19  |     .evaluate(() => {
  20  |       return globalThis.__coverage__ ?? null;
  21  |     })
  22  |     .catch(() => null);
  23  | 
  24  |   if (!browserCoverage || typeof browserCoverage !== 'object') {
  25  |     return;
  26  |   }
  27  | 
  28  |   await fs.mkdir(uiSmokeCoverageDir, { recursive: true });
  29  |   const fileName = [
  30  |     sanitizeName(testInfo.project.name),
  31  |     `worker-${testInfo.workerIndex}`,
  32  |     `retry-${testInfo.retry}`,
  33  |     `${Date.now()}.json`,
  34  |   ].join('-');
  35  |   await fs.writeFile(
  36  |     path.join(uiSmokeCoverageDir, fileName),
  37  |     JSON.stringify(browserCoverage),
  38  |     'utf8',
  39  |   );
  40  | });
  41  | 
  42  | // Scenario model aligned to renderer/ui-smoke/happy-path-workout.scenario.yaml
  43  | const TRAINING_PLANS = [
  44  |   { id: 'plan-1', name: 'Leg Day', exercise_count: 3, last_completed_at: null },
  45  |   { id: 'plan-2', name: 'Push Day', exercise_count: 2, last_completed_at: null },
  46  |   { id: 'plan-3', name: 'Pull Day', exercise_count: 2, last_completed_at: null },
  47  | ];
  48  | 
  49  | const GYMS = [
  50  |   { id: 'gym-1', name: 'Countryside Core Club' },
  51  |   { id: 'gym-2', name: 'Downtown Dumbbell Den' },
  52  | ];
  53  | 
  54  | const DEADLIFT_OPTIONS = [
  55  |   {
  56  |     id: 'opt-deadlift-a',
  57  |     training_plan_exercise_id: 'ex-deadlift',
  58  |     exercise_name: 'Deadlift',
  59  |     exercise_position: 1,
  60  |     variant_id: 'variant-deadlift-conventional',
  61  |     variant_name: 'Conventional Barbell Deadlift',
  62  |     repetition_kind: 'REPS',
  63  |     station_id: 'station-rack',
  64  |     station_name: 'Barbell Rack',
  65  |     station_profile_loads_kg: [20, 40, 60, 80, 100],
  66  |     suggested_start_load_kg: 60,
  67  |     set_tracking_mode: 'BILATERAL',
  68  |     load_input_mode: 'TOTAL',
  69  |   },
  70  |   {
  71  |     id: 'opt-deadlift-b',
  72  |     training_plan_exercise_id: 'ex-deadlift',
  73  |     exercise_name: 'Deadlift',
  74  |     exercise_position: 1,
  75  |     variant_id: 'variant-deadlift-paused',
  76  |     variant_name: 'Paused Barbell Deadlift',
  77  |     repetition_kind: 'REPS',
  78  |     station_id: 'station-platform',
  79  |     station_name: 'Platform A',
  80  |     station_profile_loads_kg: [20, 40, 60, 80, 100],
  81  |     suggested_start_load_kg: 60,
  82  |     set_tracking_mode: 'BILATERAL',
  83  |     load_input_mode: 'TOTAL',
  84  |   },
  85  |   {
  86  |     id: 'opt-deadlift-c',
  87  |     training_plan_exercise_id: 'ex-deadlift',
  88  |     exercise_name: 'Deadlift',
  89  |     exercise_position: 1,
  90  |     variant_id: 'variant-deadlift-rdl',
  91  |     variant_name: 'Romanian Deadlift',
  92  |     repetition_kind: 'REPS',
  93  |     station_id: 'station-rig',
  94  |     station_name: 'Rig B',
  95  |     station_profile_loads_kg: [20, 40, 60, 80, 100],
  96  |     suggested_start_load_kg: 60,
  97  |     set_tracking_mode: 'BILATERAL',
  98  |     load_input_mode: 'TOTAL',
  99  |   },
  100 | ];
  101 | 
  102 | const DEADLIFT_MIDDLE_OPTION = DEADLIFT_OPTIONS[1];
  103 | const DEADLIFT_MIDDLE_OPTION_KEY = `${DEADLIFT_MIDDLE_OPTION.id}::${DEADLIFT_MIDDLE_OPTION.station_id}`;
  104 | 
  105 | const PLAN_OPTIONS = {
  106 |   training_plan_id: 'plan-1',
  107 |   gym_id: 'gym-2',
  108 |   options: [
  109 |     ...DEADLIFT_OPTIONS,
  110 |     {
  111 |       id: 'opt-split-squat',
  112 |       training_plan_exercise_id: 'ex-split-squat',
  113 |       exercise_name: 'Bulgarian Split Squat',
```