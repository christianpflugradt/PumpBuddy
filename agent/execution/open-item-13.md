# Renderer implementation bypasses the required Web Components and SCSS baseline

## Summary

The renderer is implemented as a plain DOM-mounted TypeScript application with a `.css` stylesheet, which does not follow the required renderer baseline of Web Components plus SCSS.

## Evidence

- The technology baseline defines `Web Components` and `SCSS` as required renderer technologies in `agent/strategy/tech-stack.md`.
- [renderer/src/main.ts](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/main.ts#L1) imports `./styles.css` and mounts the app into a pre-existing `.app` container rather than registering or bootstrapping custom elements.
- [renderer/src/styles.css](/Users/cpf/Workspace/personal/PumpBuddy/renderer/src/styles.css#L1) is a handwritten CSS stylesheet rather than SCSS.
- [renderer/package.json](/Users/cpf/Workspace/personal/PumpBuddy/renderer/package.json#L13) declares only `typescript` and `vite` as direct dev dependencies; there is no direct SCSS workflow dependency and no Web Components helper/runtime.
- A repository search for Web Components entry points (`customElements.define`, `extends HTMLElement`, `connectedCallback`, `attachShadow`) returned no matches under `renderer/`.

## Goal

Bring the renderer back into alignment with the documented frontend stack by adopting Web Components and an SCSS-based styling pipeline, or explicitly update the authoritative stack document if the project intends to standardize on plain DOM plus CSS instead.

## Scope

- introduce a Web Components-based renderer entry path for the existing UI flow
- migrate renderer styling from plain CSS files to SCSS assets processed by the existing build
- keep the item focused on stack alignment rather than redesigning workout behavior

## Acceptance Criteria

- the renderer registers and uses at least one custom element as the primary app shell or equivalent top-level UI boundary
- renderer styles are authored in SCSS and built successfully through the existing Vite workflow
- direct evidence of Web Components and SCSS usage is present in the renderer source tree and package manifest
- renderer build and test commands continue to pass after the migration

## References

- `agent/strategy/tech-stack.md`
- `renderer/src/main.ts`
- `renderer/src/styles.css`
- `renderer/package.json`


## Review Findings

### Criterion

renderer build and test commands continue to pass after the migration

- Status: fail
- Evidence: `npm --prefix renderer run build` failed with `Preprocessor dependency "sass-embedded" not found` while compiling `renderer/src/styles.scss`.
- Risk: Renderer production build fails, blocking CI/release and preventing shipping the SCSS migration.
