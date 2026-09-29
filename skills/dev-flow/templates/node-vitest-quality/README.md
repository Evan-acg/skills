# Node/Vitest Quality Gates

Under the default workflow (see `../../references/quality-gates.md`), CRAP is the
enforced local gate; mutation testing and CI are deferred. Use this directory only
when the project enables them.

This directory is a reusable implementation extracted from the CRAP and
mutation-testing gates. It targets a repository with `src/`, Vitest coverage
(`coverage/lcov.info`) and GitHub Actions. The scripts assume they are copied to
the locations shown below, while project-specific policy remains in
configuration.

## Install

1. Copy `crap.mjs`, `mutation.mjs`, `mutation-aggregate.mjs` and
   `mutation-threshold.cjs` into `scripts/quality/`; copy `crap.config.json`
   and `stryker.config.cjs` into the project root. Copy
   `quality-gates.workflow.yml` into `.github/workflows/` or merge its jobs into
   the existing quality workflow.
2. Copy `tests/unit/quality-gates.contract.spec.js` into the project's unit-test
   directory. It protects the changed-file, shard, waiver and score contracts.
3. Install `typescript`, `@stryker-mutator/core`,
   `@stryker-mutator/vitest-runner` and the Vitest coverage provider as dev
   dependencies. Keep versions compatible with the project's Node and Vitest.
4. Add the commands below to `package.json` and use the existing test command
   to produce LCOV once per quality job.

Add these generated paths to `.gitignore`:

```text
coverage/
crap-report/
mutation-report/
mutation-aggregate/
```

```json
{
  "test:coverage": "vitest run --coverage",
  "test:changed": "vitest run --changed",
  "test:changed:coverage": "vitest run --coverage --changed",
  "crap:report": "node scripts/quality/crap.mjs report",
  "crap:check": "node scripts/quality/crap.mjs check",
  "crap:check:changed": "node scripts/quality/crap.mjs check --changed",
  "crap:baseline": "node scripts/quality/crap.mjs baseline",
  "mutation": "node scripts/quality/mutation.mjs",
  "mutation:changed": "node scripts/quality/mutation.mjs --changed",
  "mutation:aggregate": "node scripts/quality/mutation-aggregate.mjs"
}
```

## Policy

- Set the CRAP threshold and baseline in `crap.config.json`; generate the
  baseline deliberately with `crap:baseline` and review it as technical debt.
- Set `STRYKER_BREAK` in CI. The local default is report-only (`0`); invalid
  values fail instead of silently disabling the gate.
- Run changed-only CRAP checks on pull requests. Run full mutation only after a
  pull request is successfully merged; skip it for ordinary pushes, schedules,
  manual workflows and unmerged closures.
- Keep `Stryker disable` comments only for equivalent mutants and require the
  reason after a colon. The scheduler validates every eligible source file
  before running Stryker.
- Use stable sorted round-robin shards. Each shard gets its own incremental
  file, and only the aggregate job applies the mutation threshold.

## Adaptation points

- Change `LOGIC_SOURCE` and the `mutate` list when the project uses a source
  layout other than the included `src` logic directories.
- Change `coverage` in `crap.config.json` when the coverage provider writes a
  different LCOV location.
- Keep `.vue` extraction only for Vue projects. For another component format,
  provide an equivalent source extractor or exclude that format explicitly.
- Keep the exported helper behavior and add contract tests before changing
  changed-file filtering, shard assignment, waiver validation or score math.
