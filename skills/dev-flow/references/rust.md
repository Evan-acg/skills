# Rust Reference

Use this reference with `dev-flow` for Rust crates, Cargo workspaces, CLI/library/service layering, error handling, and ownership-sensitive design.

## Responsibilities

- The `app` crate owns the binary entry point: argument parsing, assembly, and calls into `features`. It holds no business logic.
- The `features` crate owns business functionality, organized as modules (auth, cart, comment, …).
- The `domain` crate owns pure domain logic: no IO, no framework dependencies.
- The `shared` crate owns business-agnostic utilities, configuration, and types.
- A public item's visibility (`pub`, `pub(crate)`) is the module's interface; keep it as narrow as the callers need.

## Layering and data flow

Layer order is `app → features → domain → shared`, one-way only. Reverse or
skipped-layer dependencies are rejected by the compile-time crate boundary and by
`cargo-deny` `bans.wrappers`. `domain` performs no IO and depends on no framework.

A library project may omit `app` and root at `features` or `domain`.

## Phase → command

Map the four verification phases (`../SKILL.md`) to Cargo aliases and lefthook. The
project companion may refine these; do not invent new phases.

| Phase | Command |
| --- | --- |
| During implementation (focused check) | `cargo clippy -p <crate> -- -D warnings`, `cargo nextest run -p <crate>` |
| Review checkpoint | inspect the diff |
| Final checkpoint (gate) | `lefthook run pre-push` |
| After commit hooks | inspect the diff; rerun focused checks if hooks changed code |

The gate runs `fmt --check`, `clippy -D warnings`, `taplo`, `typos`, `nextest`,
`test --doc`, coverage, `cargo deny check`, and `cargo machete`. While a gate is
red, repair with focused checks; run the full gate only at the final checkpoint.

### Scope triggers

- The change touches a CLI or service interaction → also run the crate's
  end-to-end test (`cargo test --test cli` or a `testcontainers`-based test).
- The change touches `Cargo.toml` or a dependency → also run `cargo deny check`
  and `cargo machete .`.
- The change adds or moves a crate or layer → also run `cargo deny check` (to
  verify `wrappers`) and `cargo metadata`.
- The change alters a library's public API before release → also run
  `cargo semver-checks check-release`.

## Symptom → tool

| Symptom | Caught by | Status |
| --- | --- | --- |
| Hallucinated import | compile error | built in |
| Swallowed error / empty handling | `clippy::let_underscore_must_use`, `unused_must_use` | enforced |
| Stub implementation | `clippy::todo`, `unimplemented` (deny); `missing_docs` | enforced |
| Long function | `clippy::too_many_lines` (warn, 100) | enforced |
| Cognitive complexity | `clippy::cognitive_complexity` (warn, 20) | enforced |
| Too many arguments | `clippy::too_many_arguments` (warn, 7) | enforced |
| Duplication / copy-paste | clippy local rules | partial — no clone detector |
| Layer / cross-layer dependency | compile-time crate boundary + `cargo-deny` `wrappers` | enforced |
| Circular dependency | Cargo forbids cyclic crate dependencies | built in |
| Unused dependency | `cargo-machete` (gate) + `cargo-udeps` (optional) | enforced |
| Supply-chain vulnerability / license | `cargo-deny` `advisories` / `licenses` / `sources` | enforced |
| Spelling / typos | `typos` | enforced |
| TOML format / key order | `taplo` | enforced |
| Test / coverage | `cargo-nextest` + `cargo-llvm-cov` | enforced |
| Narrative comments (AI tell) | — | not covered |

SOLID: **S** via the complexity and size rules and the crate boundary; **I** via
`pub`/`pub(crate)` narrowing and `cargo-public-api`; **D** via one-way layering and
a zero-IO `domain`. **O** and **L** have no automated rule.

## Defaults

Defaults; a project companion may override each.

- Coverage: report-only first, then `--fail-under-lines 60`, then `80`. Rust has no
  CRAP tool; coverage plus `clippy::cognitive_complexity` (20) is the
  approximation.
- Function ≤ 100 lines, arguments ≤ 7, cognitive complexity ≤ 20 — start as `warn`.
- Rust stable 1.98, Edition 2024, MSRV 1.85.

## Known gaps

- There is no Rust CRAP tool; coverage plus cognitive complexity approximates it, and
  the coverage threshold is not equivalent to CRAP ≤ 6.
- Same-layer features are modules, so the compiler does not prevent module-to-module
  imports; strong isolation needs a split crate registered in `wrappers`.
- Duplication detection is weak.
- `cargo-deny` `wrappers` syntax is illustrative; verify with `cargo deny check`.
- `cargo-depgraph` is GPL-3.0-or-later (rejected by the license allow-list).
- Some tools need nightly (`miri`, sanitizers, `cargo-udeps`, `cargo-fuzz`,
  `cargo-public-api`); their nightly requirements change by version.
- Thresholds are starting values; on a legacy codebase keep them at `warn` until the
  backlog converges.
- **O** and **L** of SOLID and narrative comments are not automatable.

## Assets

Copyable configuration and implementation code: `../templates/rust-quality/`.
