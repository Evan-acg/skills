# Changelog

All notable changes to this workflow are recorded here. The `VERSION` file holds
the current version. Project companions record the version they were last
synchronized to; see `references/synchronization.md`.

## 1.1.0

- Added the **Enforcement, not presence** contract: a tool, config, or command
  counts as evidence only when it has a non-empty rule set or explicit threshold,
  is wired into a script/hook/CI path, and has been observed to fail on a
  deliberate violation. Mere presence is `present-but-not-enforcing`.
- Initialization discovery now audits every detected linter, formatter,
  type-check, test runner, coverage, and gate command against the applicable
  stack reference, recording `enforced`/`partial`/`absent` plus the missing rules.
- Quality-gate detection now requires a canary: a command with no threshold or one
  that always exits zero is a missing gate, not a pass.
- Scope verification now reports a lint/type-check command that cannot fail as
  `not enforced` instead of passed.
- Added a `Verify` column to each stack reference's symptom → tool matrix,
  stating how to confirm each rule is active and fires.

## 1.0.0

- Unified the workflow as a single orchestrator (`SKILL.md`) plus stack
  references and template assets.
- Added the canonical phase vocabulary — four verification checkpoints — and
  scope triggers that add checks to a phase without becoming phases themselves.
- Added stack references for Python and Rust; aligned Java and Vue around the
  same contract.
- Separated rules (`references/`) from copyable assets (`templates/`).
- Scoped the enforced gate to CRAP; mutation testing and CI are deferred and
  documented as optional.
- Added a version anchor for project synchronization.
