# Java Reference

Use this reference with `dev-flow` for Java and Spring backend services: layered applications, persistence, transactions, integrations, and server-side state.

## Responsibilities

- The interface layer (controller, RPC endpoint, message consumer) owns transport concerns: the request/response contract, input validation, and status/error mapping. It delegates business decisions to the service layer.
- The service layer owns business rules, use-case orchestration, transaction boundaries, and calls to persistence and external clients.
- The persistence layer (repository, mapper, DAO) owns queries and the mapping between rows and domain entities.
- An entity/domain type owns domain data and its invariants. It is not a transport DTO.
- Transport objects (request/response, DTO, VO, command) own their layer's contract. Do not reuse persistence entities as API contracts by default.
- Configuration owns wiring and environment binding, not business logic.
- Exception/error types own failure classification and error codes.
- An external client/adapter owns outbound calls to third-party systems, their contract translation, and failure isolation.
- A utility owns stateless helpers, and only when there is real reuse.

## Ownership and data flow

Classify every concern before placing it:

| Concern | Default owner |
| --- | --- |
| Request/response shape | Transport object of the interface layer |
| Business rule / use-case decision | Service layer |
| Transaction boundary | Service layer, one per use case |
| Row ↔ entity mapping | Persistence layer |
| Domain data and invariants | Entity/domain type |
| Third-party contract translation | External client/adapter |
| Configuration values | Configuration layer |

Use one-way flow by default:

1. The interface layer validates input and calls one service use case.
2. The service layer applies business rules and owns the transaction.
3. The service layer reads/writes through the persistence layer and calls external adapters.
4. Results flow back as the interface layer's response contract.

Do not let the persistence layer call the interface layer, and do not leak persistence models into the API contract. Keep domain types independent of transport and storage details.

## Split signals

Redesign the type boundary when one class contains multiple independent responsibilities:

- unrelated read and write use cases in one service;
- persistence queries and business decisions interleaved;
- a transaction that spans several use cases;
- transport validation mixed with domain rules;
- a class reaching across aggregates or tables it does not own;
- third-party calls scattered instead of behind one adapter;
- the same switch/if-cascade over a type repeated in several places.

Split by responsibility and ownership, not by a mechanical line limit. Do not extract solely to shrink a file when the interface becomes less clear.

When a class grows past roughly 400 lines, re-check whether a second reason to change has appeared; treat that number as an inspection trigger, not a limit.

## Persistence contract

- Keep the query interface and its SQL mapping in sync: changing a method means checking the mapped statement/XML, entity fields, the parameter object, and every caller.
- Keep entity/field mapping and generated mapping code (annotation processors) consistent; regenerate rather than hand-edit generated code.
- Prefer explicit queries owned by the persistence layer over ad-hoc querying from the interface layer.

## Transaction and error boundaries

- Use one transaction per use-case. Do not span remote calls inside a database transaction unless the project already does.
- Classify failures with the project's business exception and error codes; centralize translation to transport responses in one place.
- Do not swallow exceptions silently; preserve cause and context.

## External integrations

- Isolate third-party calls behind an adapter; keep their contract out of domain and service signatures.
- Define timeouts and failure behavior explicitly; do not let one integration's failure corrupt unrelated state.

## Asynchronous and concurrency

- Keep async execution behind an owned executor or queue, not ad-hoc threads.
- Make async task state observable (status, failure reason) and idempotent where retries are possible.

## Shared code and reuse

- Search for an existing implementation, type, query, or helper before adding one.
- A change to shared code requires assessing affected callers and running a targeted regression.
- Do not add abstractions for single-use cases or speculative extension points.

## Language-version rule

- Target the project's configured language/runtime version; do not use syntax or APIs newer than the target. Confirm the version before using a language feature.

## Verification by scope

- Logic change: add or update the smallest relevant unit test and run it.
- No runnable test: at minimum compile the module.
- Persistence or integration change: verify compilation and mapping consistency; record the dependencies you could not exercise.
- Report the commands that ran, what was skipped and why, and the remaining risks.

## Phase → command

Map the four verification phases (`../SKILL.md`) to Maven commands. The project
companion may refine these; do not invent new phases.

| Phase | Command |
| --- | --- |
| During implementation (focused check) | `./mvnw spotless:apply`, `./mvnw -Dtest=SomeTest test`, `./mvnw compile` |
| Review checkpoint | inspect the diff; run `./mvnw -Dtest=ArchitectureTest test` when packages moved |
| Final checkpoint (gate) | `./mvnw -Dcrap.fail=true verify` |
| After commit hooks | inspect the diff; rerun focused checks if hooks changed executable code |

A full `verify` runs `spotless:check`, `checkstyle:check`, `pmd:check`,
`pmd:cpd-check`, `spotbugs:check`, compile, `surefire` (unit/integration),
`failsafe` (E2E), `jacoco:report`, `exec:exec` (CRAP), `dependency-check:check`,
and `dependency:analyze-only`. While a gate is red, repair with focused checks and
run the full `verify` only at the final checkpoint.

### Scope triggers

- The change touches a controller or a request/response boundary → also run
  `./mvnw failsafe:integration-test`.
- The change touches `pom.xml` or a dependency → also run
  `./mvnw dependency:analyze-only` and `./mvnw dependency-check:check`.
- The change moves packages or layers → also run
  `./mvnw -Dtest=ArchitectureTest test`.

## Symptom → tool

| Symptom | Caught by | Status |
| --- | --- | --- |
| Hallucinated / unresolved import | compile + `dependency:analyze-only` | enforced |
| Swallowed exception | Checkstyle `EmptyCatchBlock`, PMD `errorprone` | enforced |
| Empty / stub implementation | Checkstyle `EmptyBlock`, PMD | partial — semantic stubs are not reliably detectable |
| Large file | Checkstyle `FileLength` (400) | enforced |
| Long method | Checkstyle `MethodLength` (100), PMD `ExcessiveMethodLength` | enforced |
| God class | PMD `ExcessiveClassLength` / `TooManyMethods` / `CouplingBetweenObjects` | enforced |
| Long parameter list | Checkstyle `ParameterNumber` (4), PMD | enforced |
| Duplication / copy-paste | PMD CPD (`cpd-check`) | enforced |
| Cyclomatic complexity | PMD `CyclomaticComplexity` (20) | enforced |
| Cognitive complexity | PMD `CognitiveComplexity` (20) | enforced |
| NPath complexity | PMD `NPathComplexity` | enforced |
| Layer / cross-layer violation | ArchUnit `layeredArchitecture` | enforced |
| Domain/application bound to framework | ArchUnit `noClasses()...dependOnClassesThat()` | enforced |
| Circular dependency | ArchUnit `slices().beFreeOfCycles()` | enforced |
| Type / common errors | Error Prone (compile-time) | optional — enable after the baseline is clean |
| Bytecode-level defect | SpotBugs (`effort Max`, `threshold Medium`) | enforced |
| Security issue | find-sec-bugs | enforced |
| Dependency vulnerability | `dependency-check` | enforced |
| Dependency hygiene (unused/undeclared) | `dependency:analyze-only` | enforced |
| Formatting drift | `spotless:check` | enforced |
| Debug residue (AI tell) | PMD `bestpractices` (`SystemPrintln`) | partial |
| Narrative comments (AI tell) | — | not covered |

SOLID: **S** is approximated by the PMD and CPD complexity/size rules; **I** by the
ArchUnit layering and the `domain/port` dependency surface; **D** by the ArchUnit
layering rule. **O** and **L** have no automated rule (review and tests only).

## Defaults

State these as defaults; a project companion may override each. Thresholds are a
project decision, not a global constant.

- CRAP threshold: **6** (a deliberate strict policy, not an industry standard; the
  classic risk line is 30).
- File length 400, method length 100, parameters 4.
- Cyclomatic / cognitive complexity 20 initially, tightening toward 15 as tests land.
- Language level Java 8 (`maven.compiler.release=8`) on a build JDK of 21.
- Report-only until the baseline is clean: keep `crap.fail=false` until existing
  violations converge, then flip to `true`.

## Known gaps

- JaCoCo `COMPLEXITY` does not count try/catch branches; the CRAP number follows
  that definition — align the team on it.
- The CRAP tool is self-maintained; pair it with a real integration test against a
  `jacoco.xml` and failure-path tests (missing report, over-threshold).
- Single-file source launch needs a build JDK ≥ 11. On pure JDK 8, compile first
  (`javac`) then run with `java -cp`.
- Error Prone's Maven integration is JDK-sensitive (`--add-exports`) and can
  conflict with annotation processors; validate on a branch before adopting.
- Directory presence is not enforced; ArchUnit only constrains existing classes.
- **O** and **L** of SOLID, narrative comments, and semantic stubs are not
  reliably automatable.
- Checkstyle, SpotBugs, and find-sec-bugs are LGPL build-time tools; confirm
  licensing for commercial use.
- Browser-level E2E is out of scope: E2E here is HTTP-level (REST Assured +
  Testcontainers).

## Assets

Copyable configuration and implementation code for this stack lives in
`../templates/java-quality/`. Adapt paths and package names; do not rewrite the
CRAP analyzer.

