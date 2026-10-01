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
| Final checkpoint (changed quality) | the repository's changed-only quality command |
| After commit hooks | inspect the diff; rerun focused checks if hooks changed code |

The delivery gate runs `fmt --check`, `clippy -D warnings`, `taplo`, `typos`,
`nextest`, `test --doc`, coverage, `cargo deny check`, and `cargo machete` and
belongs to the repository's pre-push hook or remote CI. While a changed-quality
check is red, repair with focused checks and rerun only that command.

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

Each row is an audit item. `Verify` states how to confirm the rule is active and
fires on a violation; a row that cannot be shown to fire is reported as
`present-but-not-enforcing`, not as covered.

| Symptom | Caught by | Status | Verify |
| --- | --- | --- | --- |
| Hallucinated import | compile error | built in | `cargo build` fails on a bogus `use` |
| Swallowed error / empty handling | `clippy::let_underscore_must_use`, `unused_must_use` | enforced | the lints are `deny` in `Cargo.toml [lints]`; `let _ = ...` fails `cargo clippy` |
| Stub implementation | `clippy::todo`, `unimplemented` (deny); `missing_docs` | enforced | lints set to `deny`; a `todo!()` fails `cargo clippy` |
| Long function | `clippy::too_many_lines` (warn, 100) | enforced | `clippy.toml` sets `too-many-lines-threshold = 100`; a 101-line fn warns |
| Cognitive complexity | `clippy::cognitive_complexity` (warn, 20) | enforced | `clippy.toml` sets the threshold; a deeply nested fn warns |
| Too many arguments | `clippy::too_many_arguments` (warn, 7) | enforced | `clippy.toml` sets the threshold; an 8-arg fn warns |
| Duplication / copy-paste | clippy local rules | partial | only local rules fire; no clone detector |
| Layer / cross-layer dependency | compile-time crate boundary + `cargo-deny` `wrappers` | enforced | the workspace crate boundaries compile; `cargo deny check` reports a banned `wrappers` edge |
| Circular dependency | Cargo forbids cyclic crate dependencies | built in | a cyclic crate dependency fails `cargo metadata` and the build |
| Unused dependency | `cargo-machete` (gate) + `cargo-udeps` (optional) | enforced | `cargo machete .` runs in the gate; an unused dependency is reported |
| Supply-chain vulnerability / license | `cargo-deny` `advisories` / `licenses` / `sources` | enforced | `deny.toml` enables the checks; a banned license or CVE fails `cargo deny check` |
| Spelling / typos | `typos` | enforced | `typos` runs in the gate; a misspelling fails |
| TOML format / key order | `taplo` | enforced | `taplo fmt --check` runs; an unformatted TOML fails |
| Test / coverage | `cargo-nextest` + `cargo-llvm-cov` | enforced | `cargo llvm-cov nextest` runs with `--fail-under-lines`; a below-threshold run fails |
| Narrative comments (AI tell) | — | not covered | no rule exists; never report this row as enforced |

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
