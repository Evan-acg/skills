# rust-quality

Copyable assets for the Rust stack quality gate (Cargo workspace, rustfmt, clippy,
nextest, cargo-deny, cargo-llvm-cov). Pair with `references/rust.md`. Adapt crate
names (`myproject-*`); keep the thresholds as defaults overridable by the project
companion.

## Files

- `rust-toolchain.toml` — pinned channel and components.
- `Cargo.toml` — workspace members, package metadata, dependencies, and `[workspace.lints]`.
- `clippy.toml` — complexity / size thresholds.
- `rustfmt.toml`, `taplo.toml`, `typos.toml`.
- `deny.toml` — supply chain plus `bans.wrappers` layer enforcement.
- `.cargo/config.toml` — atomic Cargo aliases.
- `.config/nextest.toml` — test runner profiles.
- `lefthook.yml` — pre-commit fast feedback; pre-push full gate.
- `.gitignore`.

## Setup

1. Lay out the workspace: `crates/{app,features,domain,shared}`.
2. Copy the root configs; rename `myproject-*` to your crate names.
3. `lefthook install`.
4. Run `lefthook run pre-push`; keep coverage on the report-only alias until tests
   exist, then switch to `--fail-under-lines 60` (and later `80`).
