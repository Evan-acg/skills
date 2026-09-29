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

`dev-flow` is a **workflow skill**: once installed, the agent follows it whenever
it creates or changes product code. You don't run it — you work normally, and it
enforces discovery, module boundaries, and verification.

### Install

```bash
npx skills add Evan-acg/skills --skill dev-flow      # current project
npx skills add Evan-acg/skills --skill dev-flow -g   # all projects
```

### Use it

Ask for a change as usual. In a Flask project, for example:

> Add a `GET /reports/<id>` endpoint.

Because the task touches code, the agent loads `dev-flow`, reads the project's
`AGENTS.md`, and opens the matching stack reference (`references/python.md`).
It then:

1. **Discovers** existing routes, models, and tests before writing anything.
2. **States a plan** — the files to add or change, each one's owner, the data
   flow, and the smallest test that proves the change.
3. **Implements**, running focused checks as it goes: `uv run ruff check --fix`,
   `uv run pytest tests/…`, `uv run mypy src/app/…`.
4. **Verifies** — at the final checkpoint it runs the repository's gate once
   (`uv run poe prepush` once you adopt the templates below) and reports the
   commands, the results, and anything it could not run.

Two scope triggers add checks automatically: a change to a route, template, or
request boundary also runs the end-to-end test; a change to `pyproject.toml` or a
dependency also runs dependency-hygiene and vulnerability checks.

The same pattern applies to other stacks, using `references/java.md`,
`references/vue.md`, or `references/rust.md` and that stack's commands.

### Set up a project (optional)

New or existing projects can be initialized once:

```text
Use dev-flow to initialize this project.
```

The agent inspects the repo — language, framework, existing `AGENTS.md`, test
commands, CI — and writes a small project companion with your paths, commands,
thresholds, and boundaries, preserving existing instructions. After the skill is
updated, re-sync:

```text
Use dev-flow to synchronize this project.
```

### Enable the runnable gates

The skill defines the gate; the runnable pieces are templates you copy into the
project once. Copy the directory for your stack from the installed skill (or from
this repo) and follow its README:

```bash
# from the skill directory, into your project
cp -r templates/python-quality/. /path/to/your/project/
```

`templates/<stack>-quality/README.md` gives the exact steps for Java, Vue/Node,
Python, and Rust: merge the config, add the scripts, install the hook, then keep
the gate on the report-only variant until the baseline converges.

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
