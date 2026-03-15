# Add Dark Mode Surface Layer Depth

## Goal

Strengthen dark mode hierarchy by introducing clear layered surface contrast between background, cards, and input surfaces.

## Scope

- define or update renderer style tokens for dark mode layer levels matching the review direction
- apply layered surface tokens to workout screen structure and input controls
- keep existing component structure intact while improving visual depth and readability

## Acceptance Criteria

- workout UI uses distinct layered surfaces for app background, card regions, and input/control surfaces
- updated dark mode layering improves visual separation without reducing text contrast readability
- running `npm --prefix renderer run build` succeeds after style updates

## References

- `agent/strategy/plan.md`
- `MOBILE_FIRST_UI_UX_REVIEW.md`
- `renderer/src/styles.scss`

## Dependencies

- `item-04`

## Notes for Review

- validate recommendation 9 from `MOBILE_FIRST_UI_UX_REVIEW.md`


## Review Acceptance

- Criteria Met: All acceptance criteria for dark mode layered surface depth are satisfied; workout UI now uses distinct app background, card, and input/control surface layers with preserved readability.
- Evidence: `renderer/src/styles.scss` defines dark-mode tokens `--surface-app-bg: #0f172a`, `--surface-card: #1e293b`, and `--surface-input: #334155` in `@media (prefers-color-scheme: dark)`, and applies tokenized surfaces to `.screen-panel`, `.set-list`, `.set-row`, `.weight-input`, and `.start-select` while text tokens remain high-contrast (`--text-primary: #f8fafc`, `--text-secondary: #cbd5e1`).
- Runtime/Build Check: Executed `npm --prefix renderer run build` and observed successful Vite production build (`✓ built in 576ms`, output emitted to `renderer/dist`).
- Residual Risk: none identified.
