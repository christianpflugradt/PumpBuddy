const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

const slowMoFromEnv = Number.parseInt(process.env.PW_SLOWMO ?? '', 10);
const isSlowMoRun = Number.isFinite(slowMoFromEnv) && slowMoFromEnv > 0;

const uiSmokeCoverageEnabled = process.env.UI_SMOKE_COVERAGE === '1';
const uiSmokeCoverageDir = path.resolve(__dirname, '..', 'coverage', 'ui-smoke');
const UI_INTERACTION_TIMEOUT_MS = 10_000;

const sanitizeName = (name) => name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase();

test.afterEach(async ({ page }, testInfo) => {
  if (!uiSmokeCoverageEnabled) {
    return;
  }

  const browserCoverage = await page
    .evaluate(() => {
      return globalThis.__coverage__ ?? null;
    })
    .catch(() => null);

  if (!browserCoverage || typeof browserCoverage !== 'object') {
    return;
  }

  await fs.mkdir(uiSmokeCoverageDir, { recursive: true });
  const fileName = [
    sanitizeName(testInfo.project.name),
    `worker-${testInfo.workerIndex}`,
    `retry-${testInfo.retry}`,
    `${Date.now()}.json`,
  ].join('-');
  await fs.writeFile(
    path.join(uiSmokeCoverageDir, fileName),
    JSON.stringify(browserCoverage),
    'utf8',
  );
});

// Scenario model aligned to renderer/ui-smoke/happy-path-workout.scenario.yaml
const TRAINING_PLANS = [
  { id: 'plan-1', name: 'Leg Day', exercise_count: 3, last_completed_at: null },
  { id: 'plan-2', name: 'Push Day', exercise_count: 2, last_completed_at: null },
  { id: 'plan-3', name: 'Pull Day', exercise_count: 2, last_completed_at: null },
];

const GYMS = [
  { id: 'gym-1', name: 'Countryside Core Club' },
  { id: 'gym-2', name: 'Downtown Dumbbell Den' },
];

const DEADLIFT_OPTIONS = [
  {
    id: 'opt-deadlift-a',
    training_plan_exercise_id: 'ex-deadlift',
    exercise_name: 'Deadlift',
    exercise_position: 1,
    variant_id: 'variant-deadlift-conventional',
    variant_name: 'Conventional Barbell Deadlift',
    repetition_kind: 'REPS',
    station_id: 'station-rack',
    station_name: 'Barbell Rack',
    station_profile_loads_kg: [20, 40, 60, 80, 100],
    suggested_start_load_kg: 60,
    set_tracking_mode: 'BILATERAL',
    load_input_mode: 'TOTAL',
  },
  {
    id: 'opt-deadlift-b',
    training_plan_exercise_id: 'ex-deadlift',
    exercise_name: 'Deadlift',
    exercise_position: 1,
    variant_id: 'variant-deadlift-paused',
    variant_name: 'Paused Barbell Deadlift',
    repetition_kind: 'REPS',
    station_id: 'station-platform',
    station_name: 'Platform A',
    station_profile_loads_kg: [20, 40, 60, 80, 100],
    suggested_start_load_kg: 60,
    set_tracking_mode: 'BILATERAL',
    load_input_mode: 'TOTAL',
  },
  {
    id: 'opt-deadlift-c',
    training_plan_exercise_id: 'ex-deadlift',
    exercise_name: 'Deadlift',
    exercise_position: 1,
    variant_id: 'variant-deadlift-rdl',
    variant_name: 'Romanian Deadlift',
    repetition_kind: 'REPS',
    station_id: 'station-rig',
    station_name: 'Rig B',
    station_profile_loads_kg: [20, 40, 60, 80, 100],
    suggested_start_load_kg: 60,
    set_tracking_mode: 'BILATERAL',
    load_input_mode: 'TOTAL',
  },
];

const DEADLIFT_MIDDLE_OPTION = DEADLIFT_OPTIONS[1];
const DEADLIFT_MIDDLE_OPTION_KEY = `${DEADLIFT_MIDDLE_OPTION.id}::${DEADLIFT_MIDDLE_OPTION.station_id}`;

const PLAN_OPTIONS = {
  training_plan_id: 'plan-1',
  gym_id: 'gym-2',
  exercise_variants: [
    ...DEADLIFT_OPTIONS,
    {
      id: 'opt-split-squat',
      training_plan_exercise_id: 'ex-split-squat',
      exercise_name: 'Bulgarian Split Squat',
      exercise_position: 2,
      variant_id: 'variant-split-squat',
      variant_name: 'Dumbbell Bulgarian Split Squat',
      repetition_kind: 'REPS',
      station_id: 'station-dumbbell',
      station_name: 'Dumbbell Rack',
      station_profile_loads_kg: [10, 12.5, 15, 20, 24, 30],
      suggested_start_load_kg: 20,
      set_tracking_mode: 'UNILATERAL',
      load_input_mode: 'PER_SIDE',
    },
    {
      id: 'opt-plank',
      training_plan_exercise_id: 'ex-plank',
      exercise_name: 'Plank',
      exercise_position: 3,
      variant_id: 'variant-plank',
      variant_name: 'Plank',
      repetition_kind: 'SECS',
      station_id: null,
      station_name: '',
      station_profile_loads_kg: [],
      suggested_start_load_kg: null,
      set_tracking_mode: 'BILATERAL',
      load_input_mode: 'TOTAL',
    },
  ],
};

const OPTION_BY_ID = new Map(PLAN_OPTIONS.exercise_variants.map((option) => [option.id, option]));

const STARTED_AT = '2026-04-04T10:00:00.000Z';
const COMPLETED_AT = '2026-04-04T10:12:00.000Z';

const normalizeCompletedSets = (payloadExercise) => {
  const completedSets = payloadExercise?.completed_sets ?? [];
  return completedSets.map((set) => ({
    set_index: set.set_index,
    set_side: set.set_side,
    load_value: set.load_value ?? null,
    load_value_per_side: set.load_value_per_side ?? null,
    repetition_kind: set.repetition_kind ?? null,
    repetition_value:
      typeof set.repetition_value === 'number'
        ? set.repetition_value
        : typeof set.reps === 'number'
          ? set.reps
          : null,
    reps:
      typeof set.reps === 'number'
        ? set.reps
        : typeof set.repetition_value === 'number'
          ? set.repetition_value
          : null,
  }));
};

const nextSuggestedSet = (payloadExercise, option) => {
  const completedSets = payloadExercise?.completed_sets ?? [];
  const trackingMode = payloadExercise?.set_tracking_mode ?? option.set_tracking_mode ?? 'BILATERAL';

  if (trackingMode === 'UNILATERAL') {
    const completedCount = completedSets.length;
    const setIndex = Math.floor(completedCount / 2) + 1;
    const setSide = completedCount % 2 === 0 ? 'LEFT' : 'RIGHT';
    return {
      set_index: setIndex,
      set_side: setSide,
      suggested_load_input_kg: option.suggested_start_load_kg,
      suggested_load_total_kg: option.suggested_start_load_kg,
      repetition_kind: option.repetition_kind,
      repetition_value: option.repetition_kind === 'SECS' ? 0 : 8,
      reps: option.repetition_kind === 'SECS' ? 0 : 8,
    };
  }

  return {
    set_index: completedSets.length + 1,
    set_side: 'BILATERAL',
    suggested_load_input_kg: option.suggested_start_load_kg,
    suggested_load_total_kg: option.suggested_start_load_kg,
    repetition_kind: option.repetition_kind,
    repetition_value: option.repetition_kind === 'SECS' ? 0 : 8,
    reps: option.repetition_kind === 'SECS' ? 0 : 8,
  };
};

const nextSetFromSuggestedSet = (suggestedSet) => ({
  set_index: suggestedSet.set_index,
  set_side: suggestedSet.set_side,
});

const buildStartWorkoutPayload = (payload) => {
  const optionByPosition = new Map();
  for (const option of PLAN_OPTIONS.exercise_variants) {
    if (!optionByPosition.has(option.exercise_position)) {
      optionByPosition.set(option.exercise_position, option);
    }
  }

  const exercises = [...optionByPosition.values()]
    .sort((left, right) => left.exercise_position - right.exercise_position)
    .map((option) => ({
      training_plan_exercise_id: option.training_plan_exercise_id,
      position: option.exercise_position,
      selected_training_plan_exercise_variant_id: option.id,
      selected_variant_id: option.variant_id,
      selected_station_id: option.station_id,
      load_input_mode: option.load_input_mode,
      set_tracking_mode: option.set_tracking_mode,
      skipped_at: null,
      completed_at: null,
      completed_sets: [],
    }));

  return {
    training_plan_id: payload.training_plan_id,
    gym_id: payload.gym_id ?? null,
    started_at: payload.started_at ?? STARTED_AT,
    total_exercise_count: exercises.length,
    exercises,
  };
};

const buildWorkoutResponse = ({ payload, workoutId = 'active-1', currentExercisePosition = 1 }) => {
  const exercises = (payload.exercises ?? []).map((exercisePayload) => {
    const option =
      OPTION_BY_ID.get(exercisePayload.selected_training_plan_exercise_variant_id) ??
      PLAN_OPTIONS.exercise_variants.find((candidate) => candidate.training_plan_exercise_id === exercisePayload.training_plan_exercise_id);
    const completedSets = normalizeCompletedSets(exercisePayload);

    const responseExercise = {
      training_plan_exercise_id: exercisePayload.training_plan_exercise_id,
      position: exercisePayload.position,
      exercise_name: option?.exercise_name ?? 'Exercise',
      selected_training_plan_exercise_variant_id: exercisePayload.selected_training_plan_exercise_variant_id ?? null,
      selected_variant_id: exercisePayload.selected_variant_id ?? option?.variant_id ?? null,
      selected_variant_name: option?.variant_name ?? null,
      load_input_mode: exercisePayload.load_input_mode ?? option?.load_input_mode ?? 'TOTAL',
      set_tracking_mode: option?.set_tracking_mode ?? exercisePayload.set_tracking_mode ?? 'BILATERAL',
      selected_station_id: exercisePayload.selected_station_id ?? null,
      selected_station_name: option?.station_name ?? null,
      skipped_at: exercisePayload.skipped_at ?? null,
      completed_at: exercisePayload.completed_at ?? null,
      completed_sets: completedSets,
      suggested_set: nextSuggestedSet(exercisePayload, option),
    };

    return {
      ...responseExercise,
      next_set: nextSetFromSuggestedSet(responseExercise.suggested_set),
    };
  });

  return {
    workout: {
      id: workoutId,
      training_plan_id: payload.training_plan_id,
      training_plan_name: TRAINING_PLANS.find((plan) => plan.id === payload.training_plan_id)?.name ?? 'Leg Day',
      gym_id: payload.gym_id,
      gym_name: GYMS.find((gym) => gym.id === payload.gym_id)?.name ?? null,
      started_at: payload.started_at ?? STARTED_AT,
      updated_at: COMPLETED_AT,
      current_exercise_position: currentExercisePosition,
      total_exercise_count: payload.total_exercise_count ?? exercises.length,
      exercises,
    },
  };
};

const commandCursorResponse = ({ activeWorkoutResponse, currentExercisePosition }) => {
  const workout = activeWorkoutResponse?.workout;
  if (!workout) {
    return null;
  }

  return {
    workout: {
      ...workout,
      updated_at: COMPLETED_AT,
      current_exercise_position: currentExercisePosition,
    },
  };
};

const commandOptionResponse = ({
  activeWorkoutResponse,
  exercisePosition,
  trainingPlanExerciseVariantId,
  selectedStationId,
}) => {
  const workout = activeWorkoutResponse?.workout;
  if (!workout) {
    return null;
  }

  const selectedOption =
    PLAN_OPTIONS.exercise_variants.find(
      (option) =>
        option.id === trainingPlanExerciseVariantId &&
        (selectedStationId === null || option.station_id === selectedStationId),
    ) ?? OPTION_BY_ID.get(trainingPlanExerciseVariantId);

  if (!selectedOption) {
    return activeWorkoutResponse;
  }

  const exercises = workout.exercises.map((exercise) => {
    if (exercise.position !== exercisePosition) {
      return exercise;
    }

    const updatedExercise = {
      ...exercise,
      training_plan_exercise_id: selectedOption.training_plan_exercise_id,
      exercise_name: selectedOption.exercise_name,
      selected_training_plan_exercise_variant_id: selectedOption.id,
      selected_variant_id: selectedOption.variant_id,
      selected_variant_name: selectedOption.variant_name,
      load_input_mode: selectedOption.load_input_mode,
      set_tracking_mode: selectedOption.set_tracking_mode,
      selected_station_id: selectedOption.station_id,
      selected_station_name: selectedOption.station_name,
      skipped_at: null,
      completed_at: null,
      completed_sets: [],
    };
    const suggestedSet = nextSuggestedSet(updatedExercise, selectedOption);

    return {
      ...updatedExercise,
      suggested_set: suggestedSet,
      next_set: nextSetFromSuggestedSet(suggestedSet),
    };
  });

  return {
    workout: {
      ...workout,
      updated_at: COMPLETED_AT,
      exercises,
    },
  };
};

const commandSetResponse = ({ activeWorkoutResponse, exercisePosition, draftSet, deleteLatest = false }) => {
  const workout = activeWorkoutResponse?.workout;
  if (!workout) {
    return null;
  }

  const exercises = workout.exercises.map((exercise) => {
    if (exercise.position !== exercisePosition) {
      return exercise;
    }

    const option =
      OPTION_BY_ID.get(exercise.selected_training_plan_exercise_variant_id) ??
      PLAN_OPTIONS.exercise_variants.find((candidate) => candidate.training_plan_exercise_id === exercise.training_plan_exercise_id);
    let completedSets = [...(exercise.completed_sets ?? [])];

    if (deleteLatest) {
      if (exercise.set_tracking_mode === 'UNILATERAL') {
        const latestIndex = completedSets.reduce((latest, set) => Math.max(latest, set.set_index), 0);
        completedSets = completedSets.filter((set) => set.set_index !== latestIndex);
      } else {
        completedSets = completedSets.slice(0, -1);
      }
    } else {
      const nextSet = exercise.next_set ?? nextSetFromSuggestedSet(exercise.suggested_set);
      const inputLoad = draftSet?.load_value ?? null;
      const canonicalLoad =
        typeof inputLoad === 'number' && exercise.load_input_mode === 'PER_SIDE'
          ? inputLoad * 2
          : inputLoad;
      completedSets.push({
        set_index: nextSet.set_index,
        set_side: nextSet.set_side,
        load_value: canonicalLoad,
        load_value_per_side: typeof inputLoad === 'number' ? inputLoad : null,
        repetition_kind: option?.repetition_kind ?? exercise.suggested_set?.repetition_kind ?? 'REPS',
        repetition_value: draftSet?.repetition_value ?? null,
      });
    }

    const suggestedSet = nextSuggestedSet(
      {
        ...exercise,
        completed_sets: completedSets,
        set_tracking_mode: exercise.set_tracking_mode,
      },
      option,
    );

    return {
      ...exercise,
      completed_sets: completedSets,
      suggested_set: suggestedSet,
      next_set: nextSetFromSuggestedSet(suggestedSet),
    };
  });

  return {
    workout: {
      ...workout,
      updated_at: COMPLETED_AT,
      current_exercise_position: exercisePosition,
      exercises,
    },
  };
};

const setNumericInputViaButtons = async ({
  page,
  inputSelector,
  incrementAction,
  decrementAction,
  target,
  maxSteps = 30,
}) => {
  const input = page.locator(inputSelector);

  for (let step = 0; step < maxSteps; step += 1) {
    const rawValue = await input.evaluate((element) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
        return element.value;
      }
      return (element.textContent ?? '').trim();
    });
    const current = Number.parseFloat(rawValue);
    if (Number.isFinite(current) && Math.abs(current - target) < 0.0001) {
      return;
    }

    if (!Number.isFinite(current) || current < target) {
      await clickWithMouse(page, page.locator(`[data-ui-action="${incrementAction}"]`));
    } else {
      await clickWithMouse(page, page.locator(`[data-ui-action="${decrementAction}"]`));
    }
  }

  throw new Error(`Could not reach target value ${target} for ${inputSelector}`);
};

const clickWithMouse = async (page, locator) => {
  const target = locator.first();
  await expect(target).toBeVisible({ timeout: UI_INTERACTION_TIMEOUT_MS });
  await expect(target).toBeEnabled({ timeout: UI_INTERACTION_TIMEOUT_MS });

  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await target.click({ timeout: UI_INTERACTION_TIMEOUT_MS });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(150 * (attempt + 1));
    }
  }

  throw lastError ?? new Error('Failed to click locator after retries.');
};

const completeUnilateralSet = async (page) => {
  const completeLeftSideButton = page.getByRole('button', { name: 'Complete Left Side' });
  const completeSetButton = page.getByRole('button', { name: 'Complete Set' });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const completeSetVisible = await completeSetButton
      .isVisible()
      .catch(() => false);
    if (completeSetVisible) {
      await clickWithMouse(page, completeSetButton);
      return;
    }

    await clickWithMouse(page, completeLeftSideButton);
    const switched = await completeSetButton
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (switched) {
      await clickWithMouse(page, completeSetButton);
      return;
    }
  }

  await expect(completeSetButton).toBeVisible();
  await clickWithMouse(page, completeSetButton);
};

const maybeEnableVisualClickFeedback = async (page) => {
  if (process.env.PW_CLICK_FEEDBACK !== '1') {
    return;
  }

  const installFeedback = () => {
    if (window.__pwClickFeedbackInstalled) {
      return;
    }
    window.__pwClickFeedbackInstalled = true;

    const style = document.createElement('style');
    style.textContent = `
      html, body {
        cursor: none !important;
      }
      .pw-click-feedback-cursor {
        position: fixed;
        width: 14px;
        height: 14px;
        border-radius: 9999px;
        background: rgba(255, 60, 60, 0.95);
        border: 1px solid #fff;
        box-shadow: 0 0 0 2px rgba(255, 60, 60, 0.35);
        pointer-events: none;
        transform: translate(-50%, -50%);
        z-index: 2147483647;
      }
      .pw-click-feedback-ring {
        position: fixed;
        width: 20px;
        height: 20px;
        border-radius: 9999px;
        border: 2px solid rgba(255, 60, 60, 0.9);
        pointer-events: none;
        transform: translate(-50%, -50%) scale(0.6);
        opacity: 1;
        z-index: 2147483647;
        animation: pw-click-ring 360ms ease-out forwards;
      }
      .pw-click-feedback-target {
        outline: 3px solid rgba(255, 60, 60, 0.9) !important;
        outline-offset: 2px !important;
        transition: outline-color 120ms ease-out;
      }
      @keyframes pw-click-ring {
        from { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
        to { transform: translate(-50%, -50%) scale(2.1); opacity: 0; }
      }
    `;
    document.documentElement.appendChild(style);

    const cursor = document.createElement('div');
    cursor.className = 'pw-click-feedback-cursor';
    document.documentElement.appendChild(cursor);

    const moveCursor = (x, y) => {
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
    };

    window.addEventListener(
      'mousemove',
      (event) => {
        moveCursor(event.clientX, event.clientY);
      },
      { passive: true },
    );

    const pulseAt = (x, y) => {
      moveCursor(x, y);
      const ring = document.createElement('div');
      ring.className = 'pw-click-feedback-ring';
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
      document.documentElement.appendChild(ring);
      window.setTimeout(() => ring.remove(), 450);
    };

    window.addEventListener(
      'mousedown',
      (event) => {
        moveCursor(event.clientX, event.clientY);
        pulseAt(event.clientX, event.clientY);
      },
      { passive: true },
    );

    window.addEventListener(
      'click',
      (event) => {
        const target = event.target;
        if (target instanceof HTMLElement) {
          target.classList.add('pw-click-feedback-target');
          window.setTimeout(() => target.classList.remove('pw-click-feedback-target'), 260);
        }
        pulseAt(event.clientX, event.clientY);
      },
      true,
    );
  };

  await page.addInitScript(installFeedback);
  await page.evaluate(installFeedback).catch(() => {});
};

const setSecsViaPicker = async ({ page, minutes, seconds }) => {
  const expected = `${minutes}:${String(seconds).padStart(2, '0')}`;
  const trigger = page.getByRole('button', { name: 'Set timer value' });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await clickWithMouse(page, trigger);
    const dialog = page.getByRole('dialog', { name: 'Set time' });
    const visible = await dialog
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!visible) {
      continue;
    }

    const secondRow = dialog
      .locator(`[data-ui-action="secs-picker-second-row"][data-secs-value="${seconds}"]`)
      .first();
    const secondRowVisible = await secondRow
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!secondRowVisible) {
      await page.keyboard.press('Escape').catch(() => {});
      continue;
    }

    await secondRow.scrollIntoViewIfNeeded().catch(() => {});
    const selected = await secondRow
      .click({ timeout: UI_INTERACTION_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (!selected) {
      await page.keyboard.press('Escape').catch(() => {});
      continue;
    }

    const previewValue = await page.locator('.secs-picker-preview-value').last().textContent().catch(() => null);
    if (!(previewValue ?? '').includes(expected)) {
      await page.keyboard.press('Escape').catch(() => {});
      continue;
    }

    const applyPressed = await page
      .locator('[data-ui-action="secs-picker-apply"]')
      .last()
      .click({ timeout: UI_INTERACTION_TIMEOUT_MS })
      .then(() => true)
      .catch(() => false);
    if (!applyPressed) {
      await page.keyboard.press('Escape').catch(() => {});
      continue;
    }

    const ok = await trigger.textContent().catch(() => '');
    if ((ok ?? '').includes(expected)) {
      return;
    }
  }

  throw new Error(`Unable to set SECS picker value to ${expected}.`);
};

test('UI smoke happy path > login, select plan/gym, complete workout and view summary', async ({ page }) => {
  test.setTimeout(uiSmokeCoverageEnabled ? 120_000 : isSlowMoRun ? 180_000 : 60_000);
  const testLogin = 'main';
  let persistedWorkoutResponse = null;
  let isLoggedIn = false;
  await maybeEnableVisualClickFeedback(page);

  await page.route('**/auth/session', async (route) => {
    if (!isLoggedIn) {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { name: 'Dev User' } }),
    });
  });

  await page.route('**/auth/login', async (route, request) => {
    const payload = request.postDataJSON?.() ?? {};
    if (payload?.login !== testLogin || payload?.password !== 'test-api-key') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      return;
    }
    isLoggedIn = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/api/training-plans', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TRAINING_PLANS),
    });
  });

  await page.route('**/api/gyms', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GYMS) });
  });

  await page.route('**/api/training-plans/plan-1/options?gymId=gym-2', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PLAN_OPTIONS),
    });
  });

  await page.route('**/api/active-workout', async (route) => {
    const request = route.request();

    if (request.method() === 'GET') {
      if (!persistedWorkoutResponse) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'No active workout' }),
        });
        return;
      }

      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(persistedWorkoutResponse) });
      return;
    }

    if (request.method() === 'POST') {
      const payload = request.postDataJSON();
      persistedWorkoutResponse = buildWorkoutResponse({
        payload: buildStartWorkoutPayload(payload),
        currentExercisePosition: 1,
      });

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(persistedWorkoutResponse),
      });
      return;
    }

    await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Method not allowed' }) });
  });

  await page.route('**/api/active-workout/**', async (route) => {
    const request = route.request();
    const url = request.url();
    const pathname = new URL(url).pathname;
    const setCommandMatch = pathname.match(/\/api\/active-workout\/[^/]+\/exercises\/(\d+)\/sets(?:\/latest)?$/);
    const optionCommandMatch = pathname.match(/\/api\/active-workout\/[^/]+\/exercises\/(\d+)\/option$/);

    if (request.method() === 'PUT') {
      const payload = request.postDataJSON();
      persistedWorkoutResponse = commandCursorResponse({
        activeWorkoutResponse: persistedWorkoutResponse,
        currentExercisePosition: payload.current_exercise_position,
      });

      if (!persistedWorkoutResponse) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'No active workout' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(persistedWorkoutResponse),
      });
      return;
    }

    if (request.method() === 'POST' && optionCommandMatch) {
      const payload = request.postDataJSON();
      persistedWorkoutResponse = commandOptionResponse({
        activeWorkoutResponse: persistedWorkoutResponse,
        exercisePosition: Number.parseInt(optionCommandMatch[1], 10),
        trainingPlanExerciseVariantId: payload.training_plan_exercise_variant_id,
        selectedStationId: payload.selected_station_id ?? null,
      });

      if (!persistedWorkoutResponse) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'No active workout' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(persistedWorkoutResponse),
      });
      return;
    }

    if (request.method() === 'POST' && setCommandMatch && pathname.endsWith('/sets')) {
      const payload = request.postDataJSON();
      persistedWorkoutResponse = commandSetResponse({
        activeWorkoutResponse: persistedWorkoutResponse,
        exercisePosition: Number.parseInt(setCommandMatch[1], 10),
        draftSet: payload.set,
      });

      if (!persistedWorkoutResponse) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'No active workout' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(persistedWorkoutResponse),
      });
      return;
    }

    if (request.method() === 'POST' && url.endsWith('/complete')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'workout-1',
          training_plan_id: 'plan-1',
          training_plan_name: 'Leg Day',
          gym_id: 'gym-2',
          gym_name: 'Downtown Dumbbell Den',
          started_at: STARTED_AT,
          completed_at: COMPLETED_AT,
          exercise_count: 3,
          completed_set_count: 4,
        }),
      });
      return;
    }

    if (request.method() === 'DELETE' && setCommandMatch && pathname.endsWith('/sets/latest')) {
      persistedWorkoutResponse = commandSetResponse({
        activeWorkoutResponse: persistedWorkoutResponse,
        exercisePosition: Number.parseInt(setCommandMatch[1], 10),
        deleteLatest: true,
      });

      if (!persistedWorkoutResponse) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'No active workout' }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(persistedWorkoutResponse),
      });
      return;
    }

    if (request.method() === 'DELETE') {
      persistedWorkoutResponse = null;
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    await route.fulfill({ status: 405, contentType: 'application/json', body: JSON.stringify({ message: 'Method not allowed' }) });
  });

  await page.goto('/');

  await expect(page.getByRole('region', { name: 'Sign in' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Login' }).fill(testLogin);
  await page.getByLabel('Password', { exact: true }).fill('test-api-key');
  await clickWithMouse(page, page.getByRole('button', { name: 'Sign in' }));

  const startScreen = page.getByRole('region', { name: 'Workout start screen' });
  await expect(startScreen).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await clickWithMouse(page, page.getByLabel('Training Plan', { exact: true }));
  await page.getByLabel('Training Plan', { exact: true }).selectOption('plan-1');
  await clickWithMouse(page, page.getByLabel('Gym', { exact: true }));
  await page.getByLabel('Gym', { exact: true }).selectOption('gym-2');
  await expect(page.getByRole('button', { name: 'Start Workout' })).toBeEnabled();
  await clickWithMouse(page, page.getByRole('button', { name: 'Start Workout' }));

  await expect(page.getByRole('heading', { name: 'Deadlift' })).toBeVisible();
  const fallbackPanel = page.getByRole('region', { name: 'Fallback exercise option' });
  const completedSetHistory = page.getByLabel('Completed set history');
  await expect(fallbackPanel).toBeVisible();
  await expect(completedSetHistory).toHaveCount(0);
  await expect(page.locator('#exercise-load')).toHaveCount(0);
  await expect(page.locator('#exercise-reps')).toHaveCount(0);
  await clickWithMouse(page, page.locator('#fallback-option-select'));
  await page.locator('#fallback-option-select').selectOption(DEADLIFT_MIDDLE_OPTION_KEY);
  await clickWithMouse(page, page.getByRole('button', { name: 'Select' }));
  await expect(fallbackPanel).toHaveCount(0);
  await expect(completedSetHistory).toHaveAttribute('data-history-state', 'empty');
  await expect(page.locator('#exercise-load')).toBeVisible();
  await expect(page.locator('#exercise-reps')).toBeVisible();
  await expect(page.locator('.exercise-variant-label')).toContainText(DEADLIFT_MIDDLE_OPTION.variant_name);
  await setNumericInputViaButtons({
    page,
    inputSelector: '#exercise-load',
    incrementAction: 'increment-load',
    decrementAction: 'decrement-load',
    target: 100,
  });
  await setNumericInputViaButtons({
    page,
    inputSelector: '#exercise-reps',
    incrementAction: 'increment-reps',
    decrementAction: 'decrement-reps',
    target: 5,
  });
  await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
  await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  await expect(completedSetHistory.locator('.completed-set-row').first()).toContainText('100 kg');
  await expect(completedSetHistory.locator('.completed-set-row').first()).toContainText('5');
  await clickWithMouse(page, page.getByRole('button', { name: 'Next' }));

  await expect(page.getByRole('heading', { name: 'Bulgarian Split Squat' })).toBeVisible();
  await expect(page.locator('.set-row-field-label', { hasText: 'Load per Side' })).toBeVisible();
  await setNumericInputViaButtons({
    page,
    inputSelector: '#exercise-load',
    incrementAction: 'increment-load',
    decrementAction: 'decrement-load',
    target: 24,
  });
  await setNumericInputViaButtons({
    page,
    inputSelector: '#exercise-reps',
    incrementAction: 'increment-reps',
    decrementAction: 'decrement-reps',
    target: 8,
  });
  await completeUnilateralSet(page);
  const unilateralHistoryRow = completedSetHistory.locator('.completed-set-row').first();
  await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /left .* kg for 8 reps/);
  await expect(unilateralHistoryRow).toHaveAttribute('aria-label', /right .* kg for 8 reps/);
  await clickWithMouse(page, page.getByRole('button', { name: 'Next' }));

  await expect(page.getByRole('heading', { name: 'Plank' })).toBeVisible();
  await expect(completedSetHistory).toHaveAttribute('data-history-state', 'empty');
  await setSecsViaPicker({ page, minutes: 0, seconds: 45 });
  await clickWithMouse(page, page.getByRole('button', { name: 'Complete Set' }));
  const secsHistoryRow = completedSetHistory.locator('.completed-set-row').first();
  await expect(completedSetHistory).toHaveAttribute('data-history-state', 'populated');
  await expect(completedSetHistory.locator('.completed-set-row')).toHaveCount(1);
  await expect(secsHistoryRow).toHaveAttribute('aria-label', /0:45/);
  await expect(secsHistoryRow).not.toHaveAttribute('aria-label', /reps/);
  await expect(secsHistoryRow).toContainText('0:45');

  await clickWithMouse(page, page.getByRole('button', { name: 'Finish Workout' }));

  await expect(page.getByRole('region', { name: 'Workout completion screen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Completed' })).toBeVisible();
  await expect(page.getByLabel('Workout completion metrics')).toHaveCount(0);
});
