# Workflow Synchronization

Use this reference only when the user explicitly asks to synchronize the global `dev-flow` into the current project.

## Source and target

- Source of truth for reusable workflow rules: this skill and its applicable references.
- Project-specific source: the repository's `AGENTS.md`, workflow companion, framework supplements, architecture documents, ADRs, and delivery guidance.
- Primary target: the project workflow companion named by `AGENTS.md`.
- Secondary targets: `AGENTS.md`, framework supplements, or other workflow documents only when they contain an affected trigger, pointer, or clearly scoped workflow rule.
- Product source, package scripts, CI configuration, environment files, and domain records are not synchronization targets unless the user explicitly includes them.

## Version anchor

The skill carries a `VERSION` file and a `CHANGELOG.md`. The project companion
records the skill version it was last synchronized to.

- Read the skill's current `VERSION` and compare it with the version recorded in
  the project companion.
- Report the delta: the workflow changes that landed between the recorded version
  and the current one, taken from `CHANGELOG.md`.
- Update the recorded version only after the merge is applied.
- Synchronization stays manual: the user invokes it explicitly. The version
  anchor makes a repeated synchronization verifiable and incremental instead of a
  blind re-merge.

## Synchronization procedure

1. Discover before editing:
   - locate the repository instructions and the workflow companion path;
   - read the current global skill and only the references applicable to the project;
   - inspect the current project workflow documents and recent changes when available;
   - record existing project-specific rules, contradictions, and files that must remain untouched.
2. Classify every candidate rule:
   - **global**: reusable across projects and owned by this skill or a reference;
   - **project**: dependent on repository paths, commands, domain language, architecture, environment, or delivery process;
   - **conflict**: the global and project guidance prescribe incompatible behavior;
   - **stale**: a project rule no longer matches the repository or its configured commands.
3. Design the smallest merge:
   - keep global rules in the global skill and references;
   - keep project rules in the project documents;
   - add or update the project pointer when a new global reference is required;
   - remove duplicated generic workflow text only when the project document already points to the global rule and the removal cannot erase project-specific constraints;
   - never replace a project document wholesale.
4. Resolve boundaries:
   - preserve project-specific guidance even when it resembles a global rule if it adds local constraints or examples;
   - surface conflicts and stale facts for a decision instead of silently choosing a side;
   - do not promote a project rule to the global skill during synchronization; that is a separate change with its own review.
5. Apply the approved documentation changes, then inspect the complete diff.
6. Check idempotence by comparing the result against the source and confirming that a second synchronization would make no further changes.

## Completion report

Report all of the following:

- the version the project was synchronized from and to;
- global workflow rules applied or already present;
- project-specific rules preserved;
- files changed and files intentionally left untouched;
- conflicts or stale facts that remain unresolved;
- documentation checks or formatter checks that ran;
- unverified assumptions and residual risks.

Synchronization is complete only when the project points to the current global workflow, its local companion contains only local guidance plus necessary pointers, the complete diff has been reviewed, and no unresolved conflict was silently discarded.
