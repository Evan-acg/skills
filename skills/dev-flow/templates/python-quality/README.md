# python-quality

Copyable assets for the Python stack quality gate (Flask / uv / Ruff / mypy /
pytest). Pair with `references/python.md`. Adapt the package name (`app`,
`src/app/`); do not rewrite the CRAP analyzer.

## Files

- `pyproject-quality.toml` — the `[tool.*]` sections: Ruff, mypy, import-linter,
  pytest + coverage, bandit, deptry, poe tasks.
- `scripts/crap.py` — self-contained CRAP + size gate over `coverage.json`.
- `.pre-commit-config.yaml` — pre-commit `ruff --fix` / `ruff-format`; pre-push
  `poe prepush`.
- `tests/conftest.py` — Flask app factory and test client fixtures.
- `.gitignore`.

## Setup

1. Merge `pyproject-quality.toml` into `pyproject.toml` (the `[tool.*]` sections).
2. `uv init --name app` and `uv python pin 3.13`; add the dependencies from
   `references/python.md`.
3. Copy `scripts/` and `tests/conftest.py`; adjust the package name.
4. Install hooks: `uv run pre-commit install` and
   `uv run pre-commit install --hook-type pre-push`.
5. Run `uv run poe prepush`; keep the CRAP gate on the report variant until the
   baseline converges.
