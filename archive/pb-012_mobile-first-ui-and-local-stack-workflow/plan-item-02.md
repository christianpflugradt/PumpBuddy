# Plan: Mobile App Shell Polish

## Item Reference

- `agent/execution/open-item-02.md`

## Goal Summary

Improve narrow-screen behavior for the renderer start screen and nearby app-shell areas involved in the workout experience so a phone-sized viewport stays usable without clipping, overlap, or awkward scrolling.

## Implementation Approach

- inspect the renderer start screen and shared app-shell layout structure to find containers, spacing, or control groups that currently assume desktop width
- update the relevant Web Component markup and SCSS so the start screen and adjacent shell areas stack and size cleanly around a `390px`-wide viewport
- keep the work focused on concrete mobile pain points outside the workout guide and avoid changing the information architecture or unrelated flows
- add or adjust renderer tests only where the changed responsive behavior needs regression coverage

## Risks and Assumptions

- the most likely issues are fixed-width cards, button rows, or shell spacing rules that create hidden overflow on narrow screens
- the plan assumes the required fixes can be handled within the existing renderer components and styles without introducing broader design changes
- responsive adjustments should avoid changing existing dialog behavior, workout-guide-specific layout, or backend-facing flow logic

## Validation Plan

- run `npm --prefix renderer test -- --run`
- verify the start screen and affected shell areas at a phone-sized viewport around `390px` wide and confirm there is no obvious clipping, overlapping controls, or awkward scrolling
- confirm the changed screens still support the current workout start and resume path without altering intended behavior beyond the mobile layout polish

## Out of Scope

- workout-guide-specific mobile layout changes
- dialog behavior or modal layering changes
- broad visual redesign beyond the concrete narrow-screen issues covered by the item

## Handoff Notes for Implementation

- keep user-facing copy in English
- stay within the existing renderer stack of Web Components, SCSS, and Vite
- prefer small responsive layout fixes over structural rewrites or new component patterns
