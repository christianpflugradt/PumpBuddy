# Plan: Add Dark Mode Surface Layer Depth

## Item Reference

- `agent/execution/open-item-05.md`

## Goal Summary

Increase visual hierarchy in dark mode by defining distinct surface layers for the page background, workout cards, and input/control surfaces while preserving readability and existing layout structure.

## Implementation Approach

- Update dark mode surface tokens in `renderer/src/styles.scss` for at least three levels: base background, raised card, and interactive/input surface.
- Apply the updated surface tokens to workout screen containers and card-like regions without changing component structure.
- Apply interactive surface tokens to input and control elements used in the workout flow so controls are visually separated from surrounding cards.
- Verify text and icon contrast remains readable after token changes; adjust foreground token pairing only where needed.

## Risks and Assumptions

- Existing selectors may couple multiple surface types; careful selector targeting is needed to avoid unintended global dark mode changes.
- Dark surface adjustments can reduce perceived contrast for muted text states unless checked against current foreground tokens.
- Assumes current workout screen markup already exposes stable class hooks for layered surface styling.

## Validation Plan

- Run `npm --prefix renderer run build` and confirm successful completion.
- Visually verify dark mode shows clear separation between app background, card regions, and input/control surfaces on workout screens.
- Confirm primary and secondary text remain readable across all updated dark surfaces.

## Out of Scope

- Changes to light mode theme tokens.
- Structural refactors of workout components.
- New interaction patterns or animation changes unrelated to surface depth.

## Handoff Notes for Implementation

- Prefer token-driven updates over one-off hardcoded colors.
- Keep modifications localized to dark mode surface hierarchy concerns defined by item scope.
- Preserve existing spacing, layout, and component composition.
