# Plan: Improve Start Screen Motivation Cues

## Item Reference

- `agent/execution/open-item-06.md`

## Goal Summary

Improve the start screen motivation and orientation by adding a compact workout preview and contextual cues while keeping the start action visually dominant and quick to use.

## Implementation Approach

- Identify the start-screen render path in `renderer/src/workout-render.ts` and add a concise pre-start workout preview block with clear hierarchy and scannable text.
- Add subtle contextual indicators (such as training-plan and location cues) that match existing UI patterns and do not compete with the primary start action.
- Extend `renderer/src/styles.scss` with focused styles for the new preview and cue elements, preserving mobile-first spacing and readability.
- Keep the start CTA placement, emphasis, and interaction timing unchanged to protect the existing flow.

## Risks and Assumptions

- The available pre-start data is sufficient to render a meaningful workout preview without backend contract changes.
- Additional UI elements could crowd small screens; spacing and typography choices must prioritize start-action prominence.
- Existing design language and recommendation 10 in `MOBILE_FIRST_UI_UX_REVIEW.md` can be satisfied through renderer-only changes.

## Validation Plan

- Manually verify the start screen on narrow/mobile and desktop widths to confirm preview readability and cue clarity.
- Confirm the primary start action remains the most prominent control and launches with unchanged interaction flow.
- Run `npm --prefix renderer run build` and ensure it succeeds.

## Out of Scope

- Changing workout generation logic or backend API payloads.
- Reworking the broader workout flow beyond start-screen presentation.
- Introducing heavy animation or non-subtle visual treatments that alter established UX tone.

## Handoff Notes for Implementation

- Keep copy concise and in English per project constraints.
- Reuse existing component/style patterns where possible to avoid introducing parallel UI language.
- Treat this as a lightweight implementation guide; do not expand item scope or acceptance criteria.
