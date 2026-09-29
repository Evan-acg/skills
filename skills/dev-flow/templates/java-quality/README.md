# java-quality

Copyable assets for the Java stack quality gate (Spring Boot 2.7 / Maven / Java 8).
Pair with `references/java.md`. Adapt paths, package names (`com.example.app`),
and versions; do not rewrite the CRAP analyzer.

## Files

- `pom-plugins.xml` — the `<build><plugins>` block: Spotless, Checkstyle, PMD (+CPD),
  SpotBugs + find-sec-bugs, Error Prone, JaCoCo, CRAP (`exec-maven-plugin`),
  OWASP dependency-check, `maven-dependency-plugin`.
- `config/checkstyle/checkstyle.xml` — naming, imports, empty blocks, size limits.
- `config/pmd/ruleset.xml` — smells, complexity (cyclomatic / cognitive / NPath),
  class size, CPD.
- `config/spotbugs/exclude.xml` — SpotBugs exclude filter.
- `tools/crap/Crap.java` — self-contained CRAP gate over `jacoco.xml` (JDK only).
- `src/test/java/com/example/app/archunit/ArchitectureTest.java` — ArchUnit layering,
  framework isolation, and cycle checks.
- `lefthook.yml` — pre-commit `spotless:apply`; pre-push full `verify` gate.
- `.gitignore`.

## Setup

1. Merge `pom-plugins.xml` into `pom.xml`, then lock every `<!-- 现场锁定 -->`
   version against Maven Central.
2. Add `crap.fail=false` and `crap.threshold=6` to `<properties>`; flip `crap.fail`
   to `true` only after the baseline converges.
3. Copy `config/`, `tools/`, and the ArchUnit test into place; adjust the package.
4. Install `lefthook` and run `lefthook install`.
5. Run `./mvnw -Dcrap.fail=false verify`, then narrow the CRAP threshold over time.
