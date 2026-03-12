# Plan: Mobile Workout Guide

## Item Reference

- `agent/execution/open-item-01.md`

## Goal Summary

Adjust the workout guide so the current exercise, completed-set history, editable next set, and primary progression action remain readable and reachable on a phone-sized viewport without horizontal scrolling.

## Implementation Approach

- inspect the renderer workout guide component structure and current narrow-screen CSS to identify the elements that assume desktop spacing or fixed widths
- update the workout guide layout and SCSS so completed sets, the editable next set, and the primary action stack cleanly within a viewport around `390px` wide
- preserve the existing multi-set workout flow and only change presentation or interaction behavior where the mobile layout requires it
- add or update renderer tests that exercise the mobile workout flow where the user-visible structure or interaction changes

## Risks and Assumptions

- the main risk is hidden horizontal overflow from nested containers, tables, or button groups inside the workout guide rather than from the outer page shell
- the plan assumes the existing workout guide markup can be adapted without introducing a new frontend framework or broad app-shell redesign
- responsive fixes should avoid changing persisted workout behavior, recommendation logic, or read-only history semantics

## Validation Plan

- run renderer tests with `npm --prefix renderer test -- --run`
- verify the workout guide at a phone-sized viewport around `390px` wide and confirm the current exercise content stays readable, no horizontal scrolling is introduced, and the primary action remains reachable
- confirm the existing documented multi-set flow still behaves the same aside from the intended mobile presentation improvements

## Out of Scope

- start-screen or app-shell layout changes outside the workout guide
- modal layering or backdrop behavior
- new workout domain behavior unrelated to mobile layout usability

## Handoff Notes for Implementation

- keep user-facing copy in English
- stay within the existing renderer stack of Web Components, SCSS, and Vite
- prefer focused responsive layout changes over broader visual redesign or component rewrites
