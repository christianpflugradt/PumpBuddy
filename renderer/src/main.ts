import "./styles.css";

type WorkoutPlan = {
  name: string;
  exercises: string[];
};

const pushDayPlan: WorkoutPlan = {
  name: "Push Day",
  exercises: [
    "Barbell Bench Press",
    "Incline Dumbbell Press",
    "Seated Dumbbell Shoulder Press",
    "Cable Lateral Raise",
    "Rope Triceps Pushdown",
  ],
};

type ViewState =
  | { screen: "start" }
  | { screen: "exercise"; exerciseIndex: number };

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
  const exerciseName = pushDayPlan.exercises[exerciseIndex];
  const stepNumber = exerciseIndex + 1;
  const totalSteps = pushDayPlan.exercises.length;

  return `
    <h1>PumpBuddy</h1>
    <section class="exercise-step" aria-live="polite" aria-label="Workout exercise step">
      <p class="plan-label">${pushDayPlan.name}</p>
      <p class="step-counter">Exercise ${stepNumber} of ${totalSteps}</p>
      <h2 class="exercise-name">${exerciseName}</h2>
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
          ${exerciseIndex === totalSteps - 1 ? "disabled" : ""}
        >
          Next
        </button>
      </div>
    </section>
  `;
};

const render = (): void => {
  app.innerHTML =
    viewState.screen === "start"
      ? renderStartScreen()
      : renderExerciseScreen(viewState.exerciseIndex);
};

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

  if (action === "previous" && viewState.exerciseIndex > 0) {
    viewState = {
      ...viewState,
      exerciseIndex: viewState.exerciseIndex - 1,
    };
    render();
    return;
  }

  if (action === "next" && viewState.exerciseIndex < pushDayPlan.exercises.length - 1) {
    viewState = {
      ...viewState,
      exerciseIndex: viewState.exerciseIndex + 1,
    };
    render();
  }
});

render();
