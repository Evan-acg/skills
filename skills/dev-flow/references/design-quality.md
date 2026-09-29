# Design Quality Reference

This reference supports §2, §3, and §6. It defines what a design problem looks like, how to decide whether a design pattern is warranted, and which failure modes are specific to AI-generated code.

The goal is not short files or many patterns. A sound design is human-reviewable and context-consistent: one reason to change per module, explicit ownership, and an interface a reader can hold in mind at once. Fix the boundary that caused a problem; do not mask it with indirection.

## 1. Smell taxonomy

Treat each item as a diagnostic heuristic, not a rule. For each smell, find the boundary it points to and fix that boundary instead of adding a layer that hides the symptom.

- **God module / class**: one file owns unrelated rendering, state, requests, persistence, or domain decisions. Split by reason to change.
- **Long function**: one function performs several sequential decisions or mixes levels of abstraction. Extract the independent steps.
- **Divergent change**: one module is edited for several unrelated requests. Separate the reasons to change.
- **Shotgun surgery**: one request forces edits across many files. Consolidate the scattered responsibility under one owner.
- **Feature envy**: a method mostly reads another object's data. Move the behavior to the owner of that data.
- **Data clumps / primitive obsession**: the same parameter group travels together, or a domain concept is a bare string or number. Introduce the named concept.
- **Boolean-flag mode combinations**: flags encode several modes. Replace them with an explicit state or separate operations.
- **Duplicated source of truth**: the same fact is stored or derived in more than one place. Keep one owner.
- **Hidden mutation / ambient state**: data changes through side effects or global state. Return explicit values or pass dependencies in.
- **Redundant middle layer / middle man**: a module only forwards to another. Remove it and call the target directly.
- **Dead code**: unreachable files, exports, props, events, or watchers remain. Delete what nothing uses.
- **Comments explaining bad code**: a comment narrates confusing code instead of stating why. Rewrite the code and keep only the rationale.
- **Speculative shared utility**: a helper or abstraction exists before a second real caller. Inline it until reuse is concrete.
- **Circular dependency**: modules depend on each other. Re-establish a one-way direction.

## 2. Design patterns as outcomes

A design pattern is a name for a structure that has already earned its place. Introduce one only after the variation it absorbs is real.

Before introducing a pattern, state:

1. the variation axis it absorbs (what changes independently);
2. the simpler alternative (direct construction, a conditional, a plain function);
3. why that alternative is insufficient.

After introducing it, check:

- it absorbs a present variation rather than a hypothetical one;
- it does not add an indirection the callers must now navigate;
- it stays testable, and its interface is smaller than what it replaced;
- callers become simpler, not more coupled to the abstraction.

Patterns are refactoring outcomes, not starting points. Do not reach for a catalog; name only the structures a project actually uses, and prefer the smallest structure that holds the variation.

## 3. AI-specific smells

These failure modes are specific to generated code. The general taxonomy above does not cover them, and the quality gates do not reliably catch them.

- **Hallucinated dependency or API**: an import, package, or method that does not exist. Verify every external symbol against the project or its documentation.
- **Copy-paste implementation**: a block duplicated from elsewhere with small edits. Reuse the original or extract one owner.
- **Implicit global or ambient state**: behavior depends on state that is not passed in. Make the dependency explicit.
- **Naming and style drift**: new code uses different names or conventions than its neighbors. Follow the surrounding code.
- **Redundant comments**: comments restate the code or repeat the same explanation. Keep only what the code cannot say.

Already enforced elsewhere; do not duplicate here: unused or speculative abstractions (§6) and untested generated behavior (§7).

## Report contract

During §6 review, report every finding as: location, evidence, impact, minimal refactor, and test suggestion. If no finding survives review, state explicitly that none was found. Do not introduce a new pattern to silence a finding unless the variation axis is already clear.
