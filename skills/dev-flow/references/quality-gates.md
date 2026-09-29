# Quality Gates Reference

Use this reference with `dev-flow`. It defines the
project-agnostic gate contract. `../SKILL.md` §7 owns when to apply it; this file
owns what the gate is, how to detect it, and how to set it up when it is missing.

## Status and applicability

The enforced gate is **CRAP**, run locally at the final checkpoint. **Mutation
testing and CI are deferred**: they are defined here so a project can adopt them
later, but they are not part of the default local workflow and must not be
reported as required work. Enable them only when the project explicitly decides
to.

## The gates

- **CRAP — enforced.** A change-risk score from cyclomatic complexity and test
  coverage: `CRAP = CC² × (1 − coverage)³ + CC`. It locates functions that are
  complex and under-tested. Bring every function the change touches within the
  project's threshold.
- **Mutation testing — optional hardener.** It seeds faults into production code
  and checks whether the tests kill them. It measures test effectiveness, not
  test presence. When the project enables it, lower CRAP first, then harden tests
  until no unjustified mutant survives.

Never weaken production code or delete meaningful tests to make a gate pass.

## Detection (before applying §7)

1. Read the project's scripts (`package.json` and equivalents) and its CI
   workflow to find three commands: a coverage-producing test command, a CRAP
   check command, and a mutation command.
2. Find the thresholds and file scope the project defines, and any environment
   variable that overrides a threshold for CI.
3. Verify each command before trusting it: it must carry an explicit threshold,
   run the scope it names, and fail on a deliberate violation (a canary). A script
   that always exits zero, runs no tests, or has no threshold is a missing gate.
4. If all three commands exist and pass the verification in step 3, use the
   project's commands, thresholds, and scope verbatim. Do not invent your own.
5. If some or all are missing, go to "Setup proposal".

## Setup proposal

When a gate is missing, propose setting it up; do not install dependencies or
edit files silently. A proposal names:

- the tools, taken from the language reference (`vue.md`, `java.md`);
- the exact scripts to add and their command lines;
- the threshold values and file scope, and why;
- the CI shape below, if CI is being enabled;
- a recorded baseline of existing violations.

Get authorization before modifying the project, then implement and report the
evidence.

## Reusable Node/Vitest implementation

For a JavaScript/TypeScript project using Vitest, the companion implementation
in `../templates/node-vitest-quality/` is the default starting point. Copy the
files into the project and change only the project contract:

- `crap.config.json`: coverage LCOV path, report path, baseline path and agreed
  CRAP threshold.
- `stryker.config.cjs`: mutation globs, excluded generated/vendor files and
  report paths.
- `package.json`: expose the coverage, CRAP report/check/baseline, mutation and
  mutation aggregation commands.
- CI: choose the changed-only PR path and the full integration/scheduled path;
  use the workflow sequence documented below.

The copied analyzers already implement the non-trivial behavior from this
workflow: TypeScript AST function discovery, Vue `<script>` extraction, LCOV
line ownership for nested functions, changed-hunk filtering, non-regressing
CRAP waivers, mutation source filtering, deterministic sharding, empty-scope
reports, waiver-reason validation and aggregate mutation scoring. Do not replace
these with a percentage-only coverage check or a full-suite fallback for an
infrastructure-only change.

Adapt the implementation only when the project has a different source layout,
coverage format, test runner or CI provider. Preserve the exported helper
contracts and add a focused contract test before changing their semantics.

## Script contract

Projects should expose these scripts. The names are the convention; a project
may map them to different tools.

| Script                  | Meaning                                       | Must fail?                         |
| ----------------------- | --------------------------------------------- | ---------------------------------- |
| `test:coverage`         | Run tests and emit coverage for the CRAP tool | on test failure                    |
| `test:changed:coverage` | Run affected tests and emit coverage          | on test failure                    |
| `crap`                  | Report CRAP scores for inspection             | no                                 |
| `crap:check`            | Enforce the CRAP threshold                    | when a function exceeds it         |
| `mutation`              | Run the mutation suite                        | per the project's threshold policy |

A project may override a threshold through an environment variable (for example
`STRYKER_BREAK`) so CI can enforce a stricter value than a local run.

## Command reuse and final sequencing

A coverage-producing command is already a test execution. Treat its result as
the test result for that tree; do not immediately run a second ordinary full
test command unless the project explicitly requires a separate non-coverage
run or the coverage runner does not exercise the same suite.

If the project exposes an aggregate gate such as `gates:coverage`, use that
aggregate as the canonical final command rather than appending its component
commands again. Run changed-only CRAP after coverage has produced its input, and
run mutation only when the project's policy calls for it.

During implementation, use the smallest affected test and static checks. A
failed gate returns to that focused loop. After the final accepted fix, run the
canonical full gate once, then record the changed-only quality result. Reuse a
passing result when the production, test, configuration, and gate inputs are
unchanged; a formatter-only hook result does not invalidate it.

## CI shape (deferred)

Not applied by default. This is the shape to use only if and when the project
explicitly enables CI.

- **Pull requests**: run CRAP only on the files the change touches (a ratchet).
  Mutation testing is deferred until the pull request is successfully merged.
- **Post-merge**: run the whole mutation suite only for a successful merge event,
  reusing the tool's incremental cache.
- **Artifacts and cache**: upload gate reports and restore the mutation
  incremental result across runs.
- **Time budget**: keep the pull-request gate fast; move the strict threshold to
  the full run if the budget is exceeded.

The reference CI sequence is:

1. Before merge, run the existing typecheck/i18n/test-with-coverage gate once;
   on other supported runs, use the changed-only test-with-coverage command.
2. On a pull request, resolve changed production files and changed function
   hunks from the merge-base and run CRAP only on that scope.
3. If a pull request has no eligible production logic, emit a successful empty
   report rather than widening scope to the whole repository.
4. After a pull request is successfully merged, execute the full mutation scope
   with one stable shard per worker and an incremental file per shard. Skip
   mutation for ordinary pushes, schedules, manual runs, and unmerged closures.
5. Upload every shard report, require the expected report count, aggregate
   mutants once, and apply the mutation threshold only to the aggregate score.
6. Upload JSON/HTML/incremental reports as short-lived CI artifacts; keep
   generated reports and caches out of source control.

## Threshold and ratchet policy

- Thresholds are a project decision recorded in the project's docs or ADRs. Do
  not hardcode them in this reference.
- Gate changed production code first; existing violations converge as their files
  are touched.
- A surviving mutant may be waived only explicitly, with an inline disable and a
  stated reason, and every waiver is reviewed as a change.

The reference mutation implementation treats `Ignored` mutants as excluded from
the measured score, counts `Killed` and `Timeout` as detected, and includes
`Survived` and `NoCoverage` in the denominator. A missing or malformed
`STRYKER_BREAK` value fails immediately; an unset local value may default to
report-only while CI supplies the enforcing value.

## Applicability

Apply these gates only to stacks that have a toolchain defined in a language
reference. For an unknown stack, report that no gate convention exists instead
of inventing one.
