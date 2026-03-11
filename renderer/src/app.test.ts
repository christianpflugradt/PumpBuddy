import assert from "node:assert/strict";
import test from "node:test";

import { getNextViewState, isDigitsOnly } from "./app.ts";

test("getNextViewState starts the workout at the first exercise", () => {
  assert.deepEqual(
    getNextViewState({ screen: "start" }, "start-workout", 5),
    { screen: "exercise", exerciseIndex: 0 },
  );
});

test("getNextViewState advances through exercises and finishes on the last step", () => {
  assert.deepEqual(
    getNextViewState({ screen: "exercise", exerciseIndex: 1 }, "next", 5),
    { screen: "exercise", exerciseIndex: 2 },
  );

  assert.deepEqual(
    getNextViewState({ screen: "exercise", exerciseIndex: 4 }, "next", 5),
    { screen: "completion" },
  );
});

test("isDigitsOnly accepts digits and rejects mixed input", () => {
  assert.equal(isDigitsOnly("42"), true);
  assert.equal(isDigitsOnly("42kg"), false);
});
