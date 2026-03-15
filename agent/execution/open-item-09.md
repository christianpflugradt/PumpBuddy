# Renderer CI: TypeScript errors in `src/pumpbuddy-app.ts`

## Goal

Fix the TypeScript compilation errors that cause the renderer CI job to fail so the plan can be accepted and the CI pipeline reports green.

## Scope

- Investigate and fix the two TypeScript errors reported by the renderer CI for `src/pumpbuddy-app.ts`:
  1. "Type '() => void' is not assignable to type 'null'" at line ~23 — likely a variable or property typed `null` but assigned a function.
  2. `addEventListener` call failing because the first argument is a string literal `'pb-unauthorized'` not recognized as `keyof WindowEventMap`, and the provided listener value is `null` — adjust types or use a typed custom event.
- Limit changes to `src/pumpbuddy-app.ts` and any nearby type declarations needed to fix the errors.

## Acceptance Criteria

- `npx tsc --noEmit` completes without errors (or the project's primary TypeScript check command used by CI passes).
- The two specific errors are resolved: the variable/property typed `null` accepts the function (or the assignment is updated), and the `addEventListener` invocation uses correct types so the compiler accepts it.
- Manual verification: run the renderer CI job locally or run the same TypeScript check used by CI and confirm exit code 0.

## References

- `agent/strategy/plan.md`
- `src/pumpbuddy-app.ts`

## Notes for Review

- CI error excerpt (from stakeholder):

```
Error: src/pumpbuddy-app.ts(23,5): error TS2322: Type '() => void' is not assignable to type 'null'.
Error: src/pumpbuddy-app.ts(34,14): error TS2769: No overload matches this call.
  Overload 1 of 2, '(type: keyof WindowEventMap, listener: (this: Window, ev: PointerEvent | MouseEvent | UIEvent | Event | ErrorEvent | AnimationEvent | ... 25 more ... | WheelEvent) => any, options?: boolean | ... 1 more ... | undefined): void', gave the following error.
    Argument of type '"pb-unauthorized"' is not assignable to parameter of type 'keyof WindowEventMap'.
  Overload 2 of 2, '(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions | undefined): void', gave the following error.
    Argument of type 'null' is not assignable to parameter of type 'EventListenerOrEventListenerObject'.
Error: Process completed with exit code 2.
```

- Suggested approaches: narrow the variable type instead of `null`, or mark it as `(() => void) | null` where appropriate; for the custom event, use `new CustomEvent('pb-unauthorized')` and use `addEventListener('pb-unauthorized' as string, (e) => ...)` or create a typed event map extension so TypeScript accepts the event name and listener types.

