# Python Reference

Use this reference with `dev-flow` for Python services: Flask applications, layered code, requests, persistence, and typed domain logic.

## Responsibilities

- The interface layer (`interfaces/`: Blueprints, CLI, message entry points) owns transport: the request/response contract, input validation, and status/error mapping. It delegates business decisions to the application layer.
- The application layer (`application/`: commands, queries) owns use-case orchestration and calls into the domain and infrastructure.
- The domain layer (`domain/`: model, events, ports) owns domain data, invariants, and the abstract ports (repositories, gateways). It is framework-free.
- The infrastructure layer (`infrastructure/`: persistence, gateways) implements the domain ports.
- A configuration module owns wiring and environment binding, not business logic.
- A utility owns stateless helpers, and only when there is real reuse.

## Ownership and data flow

| Concern | Default owner |
| --- | --- |
| Request/response shape | Interface layer |
| Use-case orchestration | Application layer |
| Domain data and invariants | Domain layer |
| Repository / gateway implementation | Infrastructure layer |
| Wiring and configuration | Composition root (`create_app`) |

One-way flow: `interfaces → application → domain`, with `infrastructure → domain`
implementing ports. The domain depends on nothing else and imports no Flask,
database, or network code. The composition root (`app/__init__.py`) exposes only
`create_app()` and owns wiring, not logic.

## Phase → command

Map the four verification phases (`../SKILL.md`) to `poe` tasks. The project
companion may refine these; do not invent new phases.

| Phase | Command |
| --- | --- |
| During implementation (focused check) | `uv run ruff check <file> --fix`, `uv run pytest <file>`, `uv run mypy <file>` |
| Review checkpoint | inspect the diff |
| Final checkpoint (gate) | `uv run poe prepush` |
| After commit hooks | inspect the diff; rerun focused checks if hooks changed code |

`poe verify` = `format_check` + `lint` + `typecheck` + `test`. The gate adds
`test_cov`, CRAP, arch, sec, audit, and deps. While a gate is red, repair with
focused checks; run the full gate only at the final checkpoint.

### Scope triggers

- The change touches a route, template, or middleware → also run `uv run poe e2e`.
- The change touches dependencies (`pyproject.toml` / `uv.lock`) → also run
  `uv run poe deps` and `uv run poe audit_runtime`.

## Symptom → tool

| Symptom | Caught by | Status |
| --- | --- | --- |
| Hallucinated / unresolved import | mypy `import-not-found` + deptry + ruff `F` | enforced |
| Swallowed exception | ruff `E722`, `S110`, `S112` | enforced |
| Empty / stub implementation | ruff `PIE790` | partial |
| Duplication / copy-paste | ruff `PLR0912`, `SIM`, `PIE` | partial — no clone detector |
| Cyclomatic complexity | ruff `C901` (20), `PLR0915`, `PLR0913`, `PLR0912`, `PLR0911`; xenon | enforced |
| Large file | self-maintained CRAP script (`--max-file-lines`) | enforced |
| God class | CRAP script (`--max-class-lines`, `--max-public-methods`) | partial — no instance-attribute count |
| Cognitive complexity | — | not covered |
| Circular / layer violation | import-linter (`layers`, `forbidden`, `independence`) | enforced |
| Type errors | mypy (strict, progressive) | enforced |
| Security issue | ruff `S` + bandit | enforced |
| Dependency vulnerability | pip-audit | enforced |
| Dependency hygiene | deptry | enforced |
| Formatting drift | ruff format | enforced |
| Debug residue (AI tell) | ruff `T20`, `ERA` | partial |
| Narrative comments (AI tell) | — | not covered |

SOLID: **S** via the complexity and size rules; **I** via import-linter
`independence`; **D** via import-linter `layers`/`forbidden`. **O** and **L** have
no automated rule.

## Defaults

Defaults; a project companion may override each.

- CRAP threshold **6**; file ≤ 400 lines, class ≤ 300 lines, public methods ≤ 20.
- Cyclomatic complexity 20 initially, tightening toward 15.
- Python 3.13 baseline; fall back one level at a time.
- Report-only until the baseline is clean: keep `prepush` on the report variant
  until tests exist, then on the enforcing variant.

## Known gaps

- No reliable CRAP package exists; the CRAP tool is self-maintained
  (`templates/python-quality/scripts/crap.py`). It uses executable lines as the
  coverage denominator, dedupes radon's repeated method output, and fails loud on a
  missing coverage file.
- Cognitive complexity is not measured; cyclomatic/branch/statement counts
  approximate it.
- No clone detector.
- Semantic stubs are not reliably detectable (`PIE790` only flags redundant
  `pass`/`...`).
- **O** and **L** of SOLID are not automatable.
- Narrative comments have no deterministic rule.
- `pylint` is GPL-2.0-or-later and `ty` is beta; confirm before adopting.
- `radon cc --json` does not emit methods of nested classes, so CRAP misses them.
- On a non-UTF-8 console the CRAP script's non-ASCII output may be garbled; use
  `PYTHONUTF8=1`.

## Assets

Copyable configuration and implementation code: `../templates/python-quality/`.
Adapt the package name; do not rewrite the CRAP analyzer.
