# Vue 3 Reference

Use this reference with `dev-flow` for Vue SFCs, Vue reactivity, composables, Pinia, and feature UI state.

## Responsibilities

- A route view owns page-level orchestration, route inputs, feature composition, and handoffs between feature modules.
- A feature component owns one coherent UI or interaction responsibility and reports user intent through explicit outputs.
- A composable owns reusable stateful behavior and its lifecycle, exposing a small API of state, derived values, and actions.
- A Pinia store owns feature state that must survive across components or routes. It is not the default home for form drafts, dialog visibility, or selection.
- An API module owns transport and request/response contracts, not template state or presentation decisions.
- Types belong to the layer that owns their contracts.

## State ownership and data flow

Classify every state value before placing it:

| State kind                                            | Default owner                 |
| ----------------------------------------------------- | ----------------------------- |
| Temporary visual state, form draft, dialog, selection | Component or local composable |
| Reusable stateful interaction within a feature        | Feature composable            |
| Cross-component or cross-route feature state          | Feature Pinia store           |
| Request/response contract and transport details       | Feature API module            |

Use one-way flow by default:

1. Parents provide data and configuration through `props`.
2. Children emit explicit user intent through `emits`.
3. The owning view, composable, or store performs the state transition or async action.
4. Updated state flows back down through props or the owning feature interface.

Use `v-model` only for a genuine bidirectional editing contract. Keep props immutable, avoid silent parent or global mutation, and keep pure presentation components independent from routes, APIs, and global stores.

## Split signals

Redesign the component boundary when one SFC contains multiple independent responsibilities or state clusters:

- unrelated lists, forms, dialogs, or navigation regions;
- independently loading or error-prone async workflows;
- business decisions mixed with rendering and event wiring;
- state with different owners or lifecycles;
- direct route, API, and Pinia access required only to render;
- repeated template blocks representing a named UI concept.

Split by responsibility and ownership, not by a mechanical line limit. Do not extract solely to reduce a line count when the interface becomes less clear.

When an SFC grows past roughly 400 lines, re-check whether a second reason to change has appeared; treat that number as an inspection trigger, not a limit.

## Reactive rules

- Use `computed` for derived values and keep it free of side effects.
- Use `watch` to synchronize with an external source or perform an intentional effect, not to maintain duplicated derived state.
- Keep async actions out of templates and pure display components.
- Give emitted events and payloads explicit names and types.
- Keep composable and store return values narrow and owned by the feature that defines them.

## Quality gates (Vue + Vitest)

Apply the gate contract in `quality-gates.md`. The reference toolchain for this
stack:

- **Coverage**: `vitest run --coverage` with `@vitest/coverage-v8`, emitting LCOV.
- **CRAP — enforced**: the bundled `templates/node-vitest-quality/` implementation
  (`crap.mjs`, MIT) reads the LCOV file and fails when any production function
  exceeds the project's threshold. `ts-crap` (MIT) is an accepted alternative.
- **Mutation — optional**: `@stryker-mutator/core` with
  `@stryker-mutator/vitest-runner`; deferred, not part of the local gate.

Scripts follow the contract: `test:coverage`, `test:changed:coverage`, `crap`,
`crap:check`, and (optional) `mutation`. Override the mutation break threshold with
`STRYKER_BREAK`.

`.vue` single-file components are out of scope for CRAP and Stryker: move their
logic into composables, stores, or API modules where the gate can see it, and
cover the remaining `<script>` behavior with component and E2E tests.

## Phase → command

Map the four verification phases (`../SKILL.md`) to project scripts. The project
companion may refine these; do not invent new phases.

| Phase | Command |
| --- | --- |
| During implementation (focused check) | `npx eslint <file> --fix`, `npx vitest run <file>`, `npm run typecheck` |
| Review checkpoint | inspect the diff; run `npm run lint:fsd` and `npm run lint:structure` when slices or directories moved |
| Final checkpoint (gate) | `npm run prepush` |
| After commit hooks | inspect the diff; rerun focused checks if hooks changed code |

`prepush` runs `format:check`, `lint`, `lint:style`, `lint:structure`, `lint:fsd`,
`typecheck`, `test`, `test:coverage`, CRAP, and `arch`. While a gate is red, repair
with focused checks and run the full gate only at the final checkpoint.

### Scope triggers

- The change touches a page or an interaction → also run `npm run test:e2e`
  (rebuild login state with `npm run test:e2e:auth` if it expired).
- The change touches styles or design tokens → run `npm run tokens:build` first,
  then `npm run lint:style`.
- The change adds or moves a slice or directory → also run `npm run lint:fsd` and
  `npm run lint:structure`.

## Symptom → tool

| Symptom | Caught by | Status |
| --- | --- | --- |
| Hallucinated import | `import-x/no-unresolved` (error) | enforced |
| Swallowed exception | `no-empty` (`allowEmptyCatch: false`) | enforced |
| Empty / stub implementation | `@typescript-eslint/no-empty-function`, `no-unused-vars` | partial |
| Large `.ts` file | `max-lines` (warn, 400) | enforced |
| Long function | `max-lines-per-function` (warn, 100) | enforced |
| Oversized SFC block | `vue/max-lines-per-block` (warn; template/script 300, style 200) | enforced |
| Duplication / copy-paste | `sonarjs/no-duplicate-string` | partial |
| Complexity | `sonarjs/cognitive-complexity` (warn, 20) | enforced |
| FSD layer / cross-slice import | `steiger` `fsd/forbidden-imports` | enforced |
| FSD slice public API / segments | `steiger` `fsd/public-api`, `fsd/no-segmentless-slices` | enforced |
| Circular dependency / orphans | `dependency-cruiser` `no-circular`, `no-orphans` | enforced |
| Directory / file naming | `@ls-lint/ls-lint` | enforced |
| Hardcoded style color | `declaration-strict-value` + design tokens | enforced (see gaps) |
| Property order | `stylelint-config-recess-order` | enforced |
| Vue 3 best practices | `eslint-plugin-vue` `flat/recommended` | enforced |
| Pinia conventions | `eslint-plugin-pinia` `recommended-flat` | optional |
| Narrative comments (AI tell) | — | not covered |

SOLID: **S** via the complexity and size rules plus FSD slicing; **I** via the FSD
public API (`index.ts`) and `steiger` rules; **D** via FSD layer order and
`dependency-cruiser`. **O** and **L** have no automated rule.

## Defaults

Defaults; a project companion may override each.

- CRAP threshold **6** (strict policy, not an industry standard).
- File ≤ 400 lines, function ≤ 100 lines, SFC `<template>`/`<script>` ≤ 300,
  `<style>` ≤ 200 — start as `warn`, raise to `error` once converged.
- Cognitive complexity 20 initially, tightening toward 15.
- Node 22 LTS (≥ 22.18; `steiger` requires it).
- Report-only until the baseline is clean: point `prepush` at the report variant
  until tests exist, then at the enforcing variant.

## Known gaps

- Narrative comments have no deterministic rule.
- **O** and **L** of SOLID are not automatable.
- `eslint-plugin-pinia` is 0.4.x and unmaintained; re-evaluate before adopting.
- `eslint-plugin-sonarjs` is LGPL-3.0-only; confirm licensing.
- `ts-crap`'s CLI flags must be confirmed against `npx ts-crap --help`; its README
  mixes the `ts-anti-patterns` name.
- The design-token rule catches hardcoded colors but not arbitrary SCSS variables
  (`ignoreVariables: true`); full enforcement needs a custom check.
- `steiger` and its plugin are beta (0.x); check the migration guide before
  upgrading.
- Size thresholds are starting values; on a legacy codebase keep them at `warn`
  until the backlog converges.

## Assets

Copyable implementation assets: `../templates/node-vitest-quality/` (CRAP and
mutation analyzers, config, and CI workflow shape).
