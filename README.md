<a href="https://skills.sh/Evan-acg/skills"><img alt="skills.sh" src="https://skills.sh/b/Evan-acg/skills?style=for-the-badge" height="28"></a>

# skills

Agent skills for AI-driven development.

## dev-flow

A discovery-to-verification development workflow for product code. It defines a
stack-agnostic process — discover → design → SOLID and design-quality review →
implement → review → verify — routes to per-stack references, and ships copyable
quality-toolchain assets.

- **Process**: `SKILL.md` — phases, gate contract, and the two-track
  enforcement model (in-loop focused checks plus pre-commit/pre-push backstops).
- **Stack references**: Java/Spring, Vue 3, Python/Flask, and Rust rules, each
  with a phase → command map, a symptom → tool map, defaults, and known gaps.
- **Templates**: copyable toolchain assets per stack — CRAP analyzers, linters,
  arch tests, and hooks.

## Quickstart

### 1. Install

```bash
# project scope (default): installs into the agent's skills directory
npx skills add Evan-acg/skills --skill dev-flow

# global scope
npx skills add Evan-acg/skills --skill dev-flow -g
```

### 2. Initialize a project

In your agent, say:

```text
Use dev-flow to initialize this project.
```

It discovers the repository — language, framework, existing `AGENTS.md`, test
commands, CI — then writes the smallest setup: an `AGENTS.md` pointer plus a
project companion holding your repo's paths, commands, thresholds, and
boundaries. Existing instructions are preserved, never overwritten.

### 3. Work the loop

Every change runs the same four phases; the stack reference supplies the command
for each:

| Phase | What the agent does |
| --- | --- |
| During implementation | run the smallest focused check (affected test, typecheck, lint) |
| Review checkpoint | inspect the full diff |
| Final checkpoint | run the repo's gate once (CRAP + lint + typecheck + tests) |
| After commit hooks | re-inspect the diff if hooks changed code |

**Scope triggers** add checks when the change touches a route, template, or
request boundary (end-to-end) or a dependency manifest (dependency hygiene and
vulnerability scans).

### 4. Stack references

The agent loads the matching reference on demand:

- `references/java.md` — Java / Spring
- `references/vue.md` — Vue 3 / TypeScript frontends
- `references/python.md` — Python / Flask
- `references/rust.md` — Rust / Cargo workspaces

Copyable gate assets (CRAP analyzers, linters, architecture tests, hooks) live
under `templates/<stack>-quality/`.

### 5. Keep it in sync

When the skill changes, re-run synchronization to update a project's guidance
without overwriting its local rules:

```text
Use dev-flow to synchronize this project.
```

### Layout

```text
skills/dev-flow/
├── SKILL.md            # the workflow
├── references/         # stack rules + gate contract
├── templates/          # copyable quality-toolchain assets
├── VERSION
└── CHANGELOG.md
```

`docs/adr/` records the workflow's own decisions; `archive/` keeps the original
source documents the skill was consolidated from.

## License

No license file is present yet; add one before reuse by third parties.
