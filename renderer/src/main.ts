import "./styles.css";

type WorkoutPlan = {
  name: string;
  exercises: ExerciseStep[];
};

type ExerciseStep = {
  name: string;
  weight: number;
};

const pushDayPlan: WorkoutPlan = {
  name: "Push Day",
  exercises: [
    { name: "Barbell Bench Press", weight: 70 },
    { name: "Incline Dumbbell Press", weight: 50 },
    { name: "Seated Dumbbell Shoulder Press", weight: 35 },
    { name: "Cable Lateral Raise", weight: 15 },
    { name: "Rope Triceps Pushdown", weight: 30 },
  ],
};

type ViewState =
  | { screen: "start" }
  | { screen: "exercise"; exerciseIndex: number }
  | { screen: "completion" };

const app = document.querySelector<HTMLElement>(".app");

if (!app) {
  throw new Error("Missing .app container");
}

let viewState: ViewState = { screen: "start" };

const renderStartScreen = (): string => `
  <h1>PumpBuddy</h1>
  <section class="start-screen" aria-label="Workout start screen">
    <p class="plan-label">${pushDayPlan.name}</p>
    <button type="button" class="start-button" data-action="start-workout">Start Workout</button>
  </section>
`;

const renderExerciseScreen = (exerciseIndex: number): string => {
  const exerciseStep = pushDayPlan.exercises[exerciseIndex];
  const stepNumber = exerciseIndex + 1;
  const totalSteps = pushDayPlan.exercises.length;
  const isLastStep = exerciseIndex === totalSteps - 1;

  return `
    <h1>PumpBuddy</h1>
    <section class="exercise-step" aria-live="polite" aria-label="Workout exercise step">
      <p class="plan-label">${pushDayPlan.name}</p>
      <p class="step-counter">Exercise ${stepNumber} of ${totalSteps}</p>
      <h2 class="exercise-name">${exerciseStep.name}</h2>
      <label class="weight-label" for="exercise-weight">Weight (kg)</label>
      <div class="weight-controls" aria-label="Weight controls">
        <button type="button" class="weight-button" data-action="decrement-weight">-</button>
        <input
          id="exercise-weight"
          class="weight-input"
          data-action="weight-input"
          inputmode="numeric"
          pattern="[0-9]*"
          value="${exerciseStep.weight}"
          aria-label="Exercise weight in kilograms"
        />
        <button type="button" class="weight-button" data-action="increment-weight">+</button>
      </div>
      <div class="step-actions">
        <button
          type="button"
          class="nav-button"
          data-action="previous"
          ${exerciseIndex === 0 ? "disabled" : ""}
        >
          Previous
        </button>
        <button
          type="button"
          class="nav-button"
          data-action="next"
        >
          ${isLastStep ? "Complete Plan" : "Next"}
        </button>
      </div>
    </section>
  `;
};

const renderCompletionScreen = (): string => `
  <h1>PumpBuddy</h1>
  <section class="completion-screen" aria-label="Workout completion screen">
    <p class="plan-label">${pushDayPlan.name}</p>
    <h2 class="completion-title">Plan Completed</h2>
    <p class="completion-copy">Great work. You finished all five exercises.</p>
  </section>
`;

const render = (): void => {
  if (viewState.screen === "start") {
    app.innerHTML = renderStartScreen();
    return;
  }

  if (viewState.screen === "completion") {
    app.innerHTML = renderCompletionScreen();
    return;
  }

  app.innerHTML = renderExerciseScreen(viewState.exerciseIndex);
};

const isDigitsOnly = (value: string): boolean => /^[0-9]+$/.test(value);

app.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;

  if (action === "start-workout") {
    viewState = { screen: "exercise", exerciseIndex: 0 };
    render();
    return;
  }

  if (viewState.screen !== "exercise") {
    return;
  }

  const currentStep = pushDayPlan.exercises[viewState.exerciseIndex];

  if (action === "decrement-weight") {
    currentStep.weight = Math.max(0, currentStep.weight - 1);
    render();
    return;
  }

  if (action === "increment-weight") {
    currentStep.weight += 1;
    render();
    return;
  }

  if (action === "previous" && viewState.exerciseIndex > 0) {
    viewState = {
      ...viewState,
      exerciseIndex: viewState.exerciseIndex - 1,
    };
    render();
    return;
  }

  if (action === "next") {
    if (viewState.exerciseIndex < pushDayPlan.exercises.length - 1) {
      viewState = {
        ...viewState,
        exerciseIndex: viewState.exerciseIndex + 1,
      };
    } else {
      viewState = { screen: "completion" };
    }
    render();
  }
});

app.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }

  if (viewState.screen !== "exercise" || target.dataset.action !== "weight-input") {
    return;
  }

  const currentStep = pushDayPlan.exercises[viewState.exerciseIndex];
  const nextValue = target.value.trim();

  if (isDigitsOnly(nextValue)) {
    currentStep.weight = Number(nextValue);
    return;
  }

  target.value = String(currentStep.weight);
});

render();
