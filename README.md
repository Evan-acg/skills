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

### Install

```bash
# project scope (default): installs into the agent's skills directory
npx skills add Evan-acg/skills --skill dev-flow

# global scope
npx skills add Evan-acg/skills --skill dev-flow -g
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
