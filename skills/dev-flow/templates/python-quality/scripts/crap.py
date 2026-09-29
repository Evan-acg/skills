"""Quality metric gate: CRAP + size (file / class).

CRAP = cyclomatic_complexity^2 * (1 - coverage)^3 + cyclomatic_complexity

Inputs:
  - radon per-function/method cyclomatic complexity (deduplicated by identity,
    expanding class.methods and nested closures)
  - radon per-class line spans and method lists (class lines, public methods)
  - coverage json per-line hits (executed_lines / missing_lines)
  - source file physical line count (file size)

Coverage uses executable lines only, so blank/comment/docstring lines do not
dilute the denominator. Paths are normalized relative to cwd; a file that radon
sees but coverage does not is reported loudly (fail loud).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

COVERAGE_JSON = Path("coverage.json")


def _key(path: str) -> str:
    """Normalize to a cwd-relative POSIX path so radon and coverage keys match."""
    p = Path(path).resolve()
    try:
        p = p.relative_to(Path.cwd().resolve())
    except ValueError:
        pass  # keep absolute when outside the cwd tree
    return p.as_posix()


def _callables(path: str, blocks: list[dict]) -> list[tuple[str, dict]]:
    """Collect function/method blocks, expanding class.methods and closures, deduped.

    radon CLI JSON emits a method both in class.methods and as a top-level method
    block, so dedup is required.
    """
    seen: set[tuple[str, str, int, int]] = set()
    out: list[tuple[str, dict]] = []

    def walk(block: dict) -> None:
        key = (
            path,
            block.get("classname") or "",
            block["name"],
            block["lineno"],
            block.get("endline", block["lineno"]),
        )
        if key in seen:
            return
        seen.add(key)
        if block.get("type") in {"function", "method"}:
            out.append((path, block))
        for child in [*block.get("methods", []), *block.get("closures", [])]:
            walk(child)

    for block in blocks:
        walk(block)
    return out


def load_raw(source: str) -> dict[str, list[dict]]:
    """Call radon and return {normalized_path: [top-level block, ...]}."""
    raw = subprocess.run(
        ["radon", "cc", source, "--json", "-s"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return {_key(path): blocks for path, blocks in json.loads(raw).items()}


def _iter_classes(raw: dict[str, list[dict]]) -> list[tuple[str, dict]]:
    """Top-level class blocks (radon does not emit nested classes)."""
    return [
        (path, block)
        for path, blocks in raw.items()
        for block in blocks
        if block.get("type") == "class"
    ]


def load_blocks(source: str) -> list[tuple[str, dict]]:
    """All function/method blocks (for CRAP computation and tests)."""
    return [pair for path, blocks in load_raw(source).items() for pair in _callables(path, blocks)]


def load_coverage() -> dict[str, tuple[set[int], set[int]]]:
    data = json.loads(COVERAGE_JSON.read_text(encoding="utf-8"))
    result: dict[str, tuple[set[int], set[int]]] = {}
    for path, info in data["files"].items():
        result[_key(path)] = (
            set(info.get("executed_lines", [])),
            set(info.get("missing_lines", [])),
        )
    return result


def crap(complexity: float, coverage: float) -> float:
    return complexity**2 * (1 - coverage) ** 3 + complexity


def function_coverage(block: dict, executed: set[int], missing: set[int]) -> float:
    span = set(range(block["lineno"], block.get("endline", block["lineno"]) + 1))
    hit = len(executed & span)
    total = hit + len(missing & span)
    return hit / total if total else 1.0


def file_lines(path: str) -> int:
    return len(Path(path).read_text(encoding="utf-8").splitlines())


def class_lines(block: dict) -> int:
    return block.get("endline", block["lineno"]) - block["lineno"] + 1


def public_methods(block: dict) -> int:
    return sum(1 for m in block.get("methods", []) if not m["name"].startswith("_"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CRAP and size gate")
    parser.add_argument("--source", default="src/app")
    parser.add_argument("--fail-above", type=float, default=None, help="CRAP threshold; report-only if unset")
    parser.add_argument("--max-file-lines", type=int, default=None)
    parser.add_argument("--max-class-lines", type=int, default=None)
    parser.add_argument("--max-public-methods", type=int, default=None)
    args = parser.parse_args(argv)

    raw = load_raw(args.source)
    failures: list[str] = []

    # Size: only read files / compute when a threshold is set
    if args.max_file_lines is not None:
        for path in sorted(raw):
            n = file_lines(path)
            if n > args.max_file_lines:
                failures.append(f"[size] file {n} lines > {args.max_file_lines}  {path}")

    if args.max_class_lines is not None or args.max_public_methods is not None:
        for path, block in _iter_classes(raw):
            if args.max_class_lines is not None:
                n = class_lines(block)
                if n > args.max_class_lines:
                    failures.append(f"[size] class {n} lines > {args.max_class_lines}  {path}:{block['name']}")
            if args.max_public_methods is not None:
                k = public_methods(block)
                if k > args.max_public_methods:
                    failures.append(f"[size] public methods {k} > {args.max_public_methods}  {path}:{block['name']}")

    # CRAP (needs coverage.json)
    covered = load_coverage()
    pairs = [pair for path, blocks in raw.items() for pair in _callables(path, blocks)]
    missing_files = sorted({path for path, _ in pairs} - set(covered))
    if missing_files:
        raise RuntimeError(
            "coverage.json is missing these files (path mismatch or not covered), "
            "aborting to avoid a false negative: " + ", ".join(missing_files)
        )

    rows: list[tuple[float, str]] = []
    for path, block in pairs:
        executed, missing = covered[path]
        cov = function_coverage(block, executed, missing)
        value = crap(block["complexity"], cov)
        name = block["name"]
        if block.get("classname"):
            name = f"{block['classname']}.{name}"
        rows.append((value, f"C={block['complexity']:<3} cov={cov:5.1%}  {path}:{name}"))

    rows.sort(reverse=True)
    for value, label in rows[:20]:
        print(f"CRAP {value:6.2f}  {label}")

    if args.fail_above is not None:
        failures += [
            f"[CRAP] {value:.2f} > {args.fail_above}  {label}"
            for value, label in rows
            if value > args.fail_above
        ]

    for line in failures:
        print(line)

    gated = any(v is not None for v in (
        args.fail_above, args.max_file_lines, args.max_class_lines, args.max_public_methods,
    ))
    if not gated:
        print("report-only (no threshold enabled)")
        return 0

    print(f"over limit: {len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
