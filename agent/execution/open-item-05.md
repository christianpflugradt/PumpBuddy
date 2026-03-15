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
