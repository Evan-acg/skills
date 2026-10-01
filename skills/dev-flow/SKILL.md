---
name: dev-flow
description: Use when initializing or synchronizing a project's AI development workflow, generating or modifying product code, creating files, refactoring modules, or changing frontend UI; enforce discovery, responsibility boundaries, SOLID checks, design-quality and over-engineering review (smells, pattern fit), one-way data flow, structure review, and scope-based verification.
---

# Dev Flow

Use this workflow for product code. Project instructions remain authoritative for repository-specific paths, commands, domain language, and architectural constraints.

Project companion documents are configuration, not a second copy of this workflow. Keep them limited to repository facts, local paths, commands, domain terms, architecture boundaries, and delivery constraints. Keep discovery, design, SOLID, design-quality, framework, quality-gate, and scope-verification rules here or in the references below.

## Terms

- **Phase** — a point in the verification lifecycle: during implementation, review checkpoint, final checkpoint, or after commit hooks. The four phases are stack-agnostic and shared by every stack.
- **Focused check** — the smallest deterministic command that can fail on the current change (an affected unit test, typecheck, lint, or formatter run). It is run while the change is in flight.
- **Gate** — a full-project, thresholded command run at the final checkpoint. It fails when a metric or policy is violated.
- **Scope trigger** — a characteristic of a change (a route or template touched, a dependency manifest touched) that adds a specific check to a phase. A scope trigger is a condition, not a phase.
- **Reference** — a stack-specific rule file under `references/`, loaded on demand when a change touches that stack.
- **Companion** — the project's own workflow document. It holds only repository-specific paths, commands, thresholds, domain language, architecture boundaries, and delivery constraints.
- **Enforcement, not presence** — a tool, config, or command is evidence of a check only when it carries a non-empty rule set or an explicit threshold, is wired into a path that runs it (script, hook, or CI), and has been observed to fail on a deliberate violation. A tool that is merely present is `present-but-not-enforcing` and is treated as absent in every report.

## Initialization mode

When the user explicitly asks to initialize, set up, or bootstrap this workflow for a project, run this mode before the normal development workflow. A typical request is: `Use dev-flow to initialize this project.`

1. Discover the project before creating guidance:
   - inspect the repository root, package manager, language and framework, source layout, existing `AGENTS.md` or equivalent instructions, architecture and design documents, test commands, and CI configuration;
   - audit every detected linter, formatter, type-check, test runner, coverage, and gate command against the applicable stack reference, and record each as `enforced`, `partial`, or `absent` with its specific missing rules or thresholds — never record mere presence as a pass;
   - search for existing workflow or agent guidance before adding a new document;
   - record detected facts, contradictions, missing information, and files that must not be overwritten.
2. Design the smallest project-specific setup:
   - preserve existing instructions and merge only missing workflow requirements;
   - create or update the root `AGENTS.md` with the workflow trigger, required pre-edit discovery, applicable framework references, and verification expectations;
   - create or update the project-specific workflow companion at the path declared by the repository's `AGENTS.md` with repository-specific paths, commands, architecture boundaries, domain terminology, and delivery constraints;
   - add framework-specific guidance only when the framework is detected and the corresponding reference is applicable;
   - do not invent architecture, commands, domain rules, or CI requirements that cannot be established from the repository.
3. Apply the setup only after the initialization plan and file responsibilities are clear. Do not modify product source, package scripts, or CI as part of the baseline setup unless the user explicitly includes them.
4. Review the complete initialization diff, verify that the setup is idempotent, and run the repository's relevant documentation or configuration checks. Report created, updated, preserved, unknown, and unverified items.

Running initialization again must converge on the same setup: never duplicate instructions, overwrite user-authored guidance, or create speculative documents. If an existing rule conflicts with this workflow, surface the conflict for a decision instead of silently replacing it.

## Synchronization mode

When the user explicitly asks to synchronize the global workflow into the current project, run this mode before the normal development workflow. Read `references/synchronization.md` for the source, target, merge, conflict, and reporting contract.

The synchronization target is the project's workflow guidance, not product code. Preserve project-specific paths, commands, domain language, architecture boundaries, and delivery constraints; update only the workflow portions that should follow this skill. Do not overwrite user-authored guidance or copy the complete global workflow into a project companion.

## Project companion boundary

- Read the project companion when the task needs repository-specific facts; do not copy the general workflow into it.
- Put a rule in the companion only when it depends on this repository's paths, scripts, domain language, architecture, environment, or delivery process.
- If a local rule is broadly reusable, move it to this skill or an applicable reference instead of preserving duplicate wording in the project.

## References

- `references/quality-gates.md` — the gate contract used in §7. The enforced gate is CRAP; mutation testing and CI are optional and deferred.
- `references/local-service-verification.md` — the lifecycle contract for local HTTP services, startup checks, and browser E2E prerequisites.
- `references/vue.md` — Vue 3, composables, Pinia, TypeScript frontends, and Vitest specifics.
- `references/java.md` — Java and Spring specifics.
- `references/python.md` — Python, Flask, uv, Ruff, mypy, and pytest specifics.
- `references/rust.md` — Rust, Cargo workspaces, clippy, rustfmt, and nextest specifics.
- `references/design-quality.md` — smell taxonomy, design-pattern guardrails, and AI-specific smells used in §2, §3, and §6.
- `references/synchronization.md` — the contract for synchronizing this workflow into a project's guidance.

## 1. Discover before designing

- Read the applicable repository instructions, architecture documents, design rules, glossary, and ADRs.
- Search for existing implementations, types, APIs, state modules, tests, and public entry points before creating a file or abstraction.
- Identify the narrowest owner for the change and record contradictions between the request, code, and documented architecture.
- Audit every detected quality tool against the applicable stack reference's required rules and thresholds instead of recording its presence. Classify each as `enforced`, `partial`, or `absent` per the Enforcement term, and list the specific missing rules, thresholds, or wiring as gaps.
- Treat a prototype or experiment as temporary unless the project explicitly defines it as production code.

## 2. Design before writing

For new modules, cross-file changes, and UI changes, state a short plan before creating files. Name:

- the responsibility of every new or changed file;
- the direction of data and dependency flow;
- the public interface between modules or components;
- the smallest verification set that can prove the change;
- when introducing a design pattern, the variation it absorbs, the simpler alternative, and why that alternative is insufficient.

Use one primary reason to change as the default module boundary. Prefer a deep module with a small, explicit interface over a large file mixing rendering, state, requests, persistence, and domain decisions. Do not create a generic helper, shared module, or abstraction before a concrete reuse case exists.

## 3. Design quality guardrails

Apply SOLID as a design check, not as a reason to add layers:

- **Single responsibility**: each file, component, composable, and store has one primary reason to change.
- **Open/closed**: add behavior at an owning feature boundary instead of scattering conditionals or editing unrelated consumers.
- **Liskov substitution**: implementations and variants honor the same input, output, and error contracts without surprising exceptions.
- **Interface segregation**: expose small module interfaces, component props and events, composable returns, and store actions.
- **Dependency inversion**: high-level code depends on feature interfaces rather than transport details or sibling internals.

Look for god modules, duplicated sources of truth, hidden mutation, and shotgun changes: fix the boundary that caused the smell instead of masking it with indirection. Read `references/design-quality.md` for the full smell taxonomy, design-pattern guardrails, and AI-specific smells.

## 4. Implement the smallest coherent slice

- Keep each module inside its owning layer and expose only the interface its callers need.
- Keep transport and data contracts separate from UI state and presentation decisions.
- Keep templates declarative and business decisions out of pure presentation components.
- Prefer explicit inputs, outputs, and dependencies over ambient state, hidden mutation, and duplicated state.
- When changing an existing large file, list the responsibilities touched and intentionally left alone. Extract the touched independent responsibilities unless a separate refactor is requested.

## 5. Framework branches

When a change touches a framework with a reference in this skill directory, read that reference before designing the change. Treat the reference's symptom → tool matrix as the enforcement audit checklist: confirm each applicable rule is configured and fires on a violation, and report uncovered or non-enforcing rules instead of assuming the tool's presence covers them.

- **Vue 3 · frontend**: for Vue SFCs, Vue reactivity, composables, Pinia, TypeScript frontends, or feature UI state, read `references/vue.md`.
- **Java · Spring**: for Java services, layered Spring applications, persistence, transactions, integrations, or server-side state, read `references/java.md`.
- **Python · Flask**: for Python services, Flask applications, layering, requests, persistence, or typed domain code, read `references/python.md`.
- **Rust**: for Rust crates, Cargo workspaces, CLI/library/service layering, error handling, or ownership-sensitive design, read `references/rust.md`.

## 6. Review before final verification

When `/code-review` is used, its Standards axis owns this structural checklist.
The main agent performs the diff handoff and aggregates the result; it does not
run a second structural review. Without `/code-review`, the main agent applies
this checklist locally.

Inspect the complete diff and confirm:

- every new file has one clear owner and one primary responsibility;
- dependency direction and public interfaces are valid;
- each state value has one owner and each transformation has one source of truth;
- no existing implementation was duplicated under a new name;
- no unused file, export, prop, event, watcher, or abstraction was added;
- a legacy large component did not grow without extracting a touched responsibility or documenting why it remains local.

Report each finding against the report contract in `references/design-quality.md`, or state explicitly that none was found.

These checks cover structure the metrics cannot measure: ownership, duplicate
sources, and unused abstractions. Whether the code is trustworthy is decided by
the quality gates in §7, not by reading the diff.

## Verification Ownership

Keep one evidence ledger for the current batch. The main agent owns command
execution and records each result with the tree identity, command, scope, and
outcome. Review agents consume that ledger; they do not rerun tests, lint,
typechecks, coverage, CRAP, dependency checks, or project-specific validation.
If evidence is missing, they report the gap instead of silently starting a
second verification loop.

Use one review invocation for one stable batch. When `/code-review` is used,
its Standards and Spec axes are the sole qualitative review for that batch; the
main agent performs the diff handoff and aggregates findings, but does not run
a second copy of either axis. If the review changes production code or the
spec, rerun only the focused checks affected by that change. Re-run an axis only
when its inputs changed or its previous result is invalidated; do not restart
both axes by default.

Reuse a passing result while the verified tree and command inputs are unchanged.
Skills must not invoke the project's delivery gate. Do not rerun changed-quality
checks because a review agent finished, because a commit hook ran unchanged
checks, or because a report needs to be reformatted. A hook that changes
executable source, tests, or configuration invalidates the relevant focused
evidence; a hook that changes only formatting does not invalidate behavior or
type evidence.

Keep commands with shared temporary files or generated outputs serial. Parallel
execution is reserved for read-only checks with independent working state.

## Verification lifecycle

This section defines the canonical phase vocabulary: the four checkpoints below
are the only phases. The stack reference supplies the command that fulfils each
one; the project companion may refine it. Do not invent additional phases.

Treat a coherent batch of changes as the unit of verification. Keep one tight,
focused feedback loop while the batch is changing, then freeze the batch before
the final review and changed-quality check.

1. **During implementation**: run only the smallest deterministic checks that
   can fail on the current change. Prefer affected unit tests, typecheck, lint,
   and formatter checks. Group related fixes before starting another check.
2. **At the review checkpoint**: freeze the batch, inspect the complete diff,
   and invoke `/code-review` once when requested. Pass the evidence ledger to
   its agents and require qualitative review only. Resolve accepted findings
   together; after those edits, return to focused checks rather than restarting
   the full verification sequence.
3. **At the final checkpoint**: after the last production, test, or configuration
   edit, run the repository's canonical changed-only quality check. Do not run
   the project's delivery gate from a skill. The delivery gate belongs to the
   pre-push hook and the remote CI pipeline.
4. **After commit hooks**: inspect the resulting diff. Reuse the final result if
   hooks changed only formatting or made no effective source/test/config change;
   rerun focused or changed-quality checks when they changed executable code.

### Scope triggers

A scope trigger adds a specific check to a phase when the change has a given
characteristic. Apply the trigger at the final checkpoint unless stated
otherwise. The stack reference defines the command; the project companion may
refine it.

- The change touches a route, template, or request/response boundary → add the
  stack's end-to-end check.
- The change touches a dependency manifest or lockfile → add the stack's
  dependency-hygiene and vulnerability checks.
- The verification needs a local dev server, HTTP probe, startup/module-loading
  measurement, proxy check, or browser E2E run → load
  `references/local-service-verification.md`. Reuse a healthy matching service
  when possible; start one only when needed. A browser E2E command uses the
  repository's configured Playwright, Cypress, or equivalent workflow.

A scope trigger is a condition, not a phase: do not report it as a phase.

The completion criterion is one stable final diff, one qualitative review, one
changed-quality result, and recorded evidence for each required scope. The
delivery gate is recorded as deferred to pre-push or remote CI. A previously
passing result remains valid for the same tree; a new run needs a changed input
or a new failure signal.

## 7. Apply deterministic quality gates

Read `references/quality-gates.md` before applying this section. It defines the
gate contract and the delivery boundary: skills run changed-quality checks;
the project's delivery gate is owned by pre-push and remote CI. It also defines
the script contract and the detection and setup rules.

When a change adds or alters production behavior, treat metrics as the authority
on trustworthiness. Use focused checks while repairing a failing check, then run
the changed-quality check at the final checkpoint. Do not invoke the delivery
gate from a skill. Never weaken production code or delete meaningful tests to
make a gate pass.

- **Detect.** Find the project's coverage, CRAP, and mutation commands and its
  thresholds. Use them verbatim; do not invent your own. Verify before trusting:
  a command counts only when its threshold is set, it runs the scope it names, and
  it fails on a deliberate violation (a canary). A script that always exits zero,
  runs no tests, or has no threshold is a missing gate — report it; do not pass it.
- **When a gate is missing.** Propose setting it up per `references/quality-gates.md`
  (tools, scripts, thresholds, scope, baseline) and get authorization
  before modifying the project. For a Node/Vitest project, start from the
  implementation assets in `templates/node-vitest-quality/`; adapt configuration
  and paths instead of rewriting the analyzers or mutation scheduler.
- **Clean (CRAP).** Bring every production function the change touches within the
  project's CRAP threshold, by lowering complexity or raising coverage.
- **Harden (mutation, optional).** When the project's policy enables mutation
  testing, strengthen tests until no unjustified surviving mutant remains on
  changed code. Waive an equivalent mutant only explicitly, with a stated reason.
- **Ratchet.** Gate changed production code first; existing code converges as its
  files are touched.
- **Applicability.** Apply the gates only to stacks with a toolchain defined in a
  language reference. For an unknown stack, report that no gate convention exists
  instead of inventing one.
- **Report.** State the gate command, the scope, the before/after value, and any
  waiver, or state explicitly that the project has no gates configured.

If a check fails, fix the smallest load-bearing cause and rerun the focused check
that goes red on that cause. Do not rerun unrelated suites or the delivery gate
from a skill.

These gates supplement §6; they do not replace it.

## 8. Verify by scope

Combine these evidence requirements with the scope triggers in Verification lifecycle.

- Documentation or mechanical changes: inspect the diff and run the relevant formatter or checker.
- Source changes: run the repository's lint and type-check commands, and confirm
  they are configured to enforce (rules active, `strict` on). A command that cannot
  fail is reported as `not enforced`, not as passed.
- Behavior changes: add or update the smallest relevant unit, integration, or E2E test, then run it.
- Page or interaction changes: use the repository's browser workflow to inspect the affected viewport, browser errors, and interaction path.
- Local-service checks: report the service identity, whether it was reused or
  started by the run, readiness result, timings, threshold result, log path, and
  cleanup result. Apply the local-service reference before browser E2E.

Report commands that ran, commands that were not applicable, and remaining risks. The change is complete only when structure review and applicable verification evidence are both present.
