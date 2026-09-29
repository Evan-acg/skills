# Changelog

All notable changes to this workflow are recorded here. The `VERSION` file holds
the current version. Project companions record the version they were last
synchronized to; see `references/synchronization.md`.

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
