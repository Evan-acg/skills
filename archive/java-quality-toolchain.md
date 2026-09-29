# Java 质量工具链（Spring Boot 2.7 + Maven + Checkstyle + PMD + SpotBugs + ArchUnit，Java 8 基线）

> 一份**可迁移**的本地质量工具链说明：把它整体搬到任意 Java 8 + Spring Boot（或纯 Java）项目即可使用。
> 推荐目录结构采用 **DDD 四层（端口-适配器）**；本文档自包含，不依赖任何特定仓库或内部工作流契约。
> 示例包名统一用 `com.example.app`。

## 0. 一句话总结

用一套**社区最佳实践**命名的 Maven 命令，把「代码质量 + 坏味道 + AI slop 近似 + DDD 架构/依赖方向 + 传统分层边界 + 大文件/大方法/上帝类 + 缺陷与类型近似 + 测试 + CRAP + 安全与依赖卫生」装进本地门禁，在 `push` 之前就能拦住问题；CI 与 mutation testing 不属本门禁范畴。

## 1. 适用与边界

- **适用**：**语言级别 Java 8**、以 Maven 构建的 Java 项目；推荐 **Spring Boot 2.7.18**（Java 8 最后支持线），纯 Java 项目同样适用。
- **构建基线**：**构建 JDK 21 LTS + `maven.compiler.release=8`**（情形 A，本文默认）。语言级别与工具运行 JDK 分离，见 §2.1。
- **参考案例**：任意 Java 8 + Spring Boot/Maven 项目（四层或待迁移到四层）；仅作对照，不在本次改动范围内。
- **包含**：格式化、静态 lint、坏味道、AI slop 近似、DDD 架构与依赖方向、大文件/大方法/上帝类、缺陷检测、类型近似、单元/集成测试、Spring 端到端测试、CRAP 门禁、安全扫描、依赖卫生、Git 钩子。
- **不包含**：CI 流水线（另一阶段）、mutation testing（属不定时任务，见 §9.4）。样式/设计 token 层：Java 后端项目**不适用**（见 §13）。

## 2. Java 基线与版本回退表

### 2.1 语言级别 ≠ 工具运行 JDK

Java 生态里「项目编译目标」与「工具链运行 JDK」是**两个独立概念**，必须分开管理：

| | 情形 A（本文默认） | 情形 B（回退） |
|---|---|---|
| 构建 JDK | **21 LTS**（跑 Maven、插件、测试） | **JDK 8** |
| 项目语言级别 | Java 8（`release=8`） | Java 8 |
| 后果 | 现代工具全部可用 | 几乎所有工具需回退到历史版本，Error Prone / OWASP dependency-check 不建议使用 |

`pom.xml`：

```xml
<properties>
  <java.version>1.8</java.version>
  <maven.compiler.release>8</maven.compiler.release>
</properties>
```

> 用 `maven.compiler.release=8`（而非 `source/target=8`）能正确锁定 Java 8 API 面，避免在 JDK 21 上误用高版本 API 却只在运行期才报错。
>
> **不要用 JDK 8 去运行需要现代 JDK 的插件**；若机器上确实只有 JDK 8，按 §2.2 的「情形 B」列回退各工具。

### 2.2 版本回退表（按构建 JDK / 语言级别）

**基线：构建 JDK 21 LTS + `release=8`。** 若迁移到更低环境，按此表回退；一次只降一个层级，并以各工具官方 `System Requirements` 为准。

| 工具 | 情形 A（构建 JDK 21 / release 8） | 情形 B（纯 JDK 8 运行的最后版本） |
|---|---|---|
| Spotless | 当前线（8.x） | 2.43.0 |
| google-java-format | 随 Spotless 指定 | 1.7 |
| Checkstyle | 当前线（14.x） | 9.3 |
| PMD | 7.x（含 `CognitiveComplexity`） | 6.55.0 |
| SpotBugs | 4.10.x | 4.8.6 |
| find-sec-bugs | 1.14.x | 1.13.0（配 SpotBugs 4.8.x） |
| Error Prone | 2.50.x | 2.27.1（**不推荐**） |
| NullAway | 0.14.x | 随 Error Prone，基本不可用 |
| ArchUnit | 1.x | 1.x（仍支持 Java 8） |
| JUnit 5 | 5.13.x | 5.13.x（JUnit 6 要求 Java 17） |
| AssertJ | 3.27.x | 3.27.x（AssertJ 4 要求 Java 17） |
| Mockito | 4.11.x | 4.11.0（Mockito 5 要求 Java 11） |
| JaCoCo | 0.8.x（最新 0.8.15） | 0.8.12 |
| Testcontainers | 1.x 线 | 1.x 线（2.x 进入现代 JDK 线） |
| REST Assured | 5.x | 5.x |
| OWASP dependency-check | 当前线 | 8.4.3（**不建议**） |
| Spring Boot | 2.7.18 | 2.7.18 |

> **竖线含义**：左列是「构建 JDK 现代、语言级别 Java 8」，右列是「连工具也得在 JDK 8 上跑」。二者都对，但工具版本差一个 major。
>
> **情形 B 的诚实建议**：优先**升级构建 JDK**，而不是把工具一路降级；Error Prone、OWASP dependency-check、现代 Checkstyle 在纯 JDK 8 下属末代，长期不建议（见 §13）。

### 2.3 目录结构约束（DDD 四层）

**规范目录树**（Maven `src/main/java` 布局；包根 `com.example.app`）：

```text
<repo>/
├── pom.xml
├── mvnw / mvnw.cmd / .mvn/wrapper/     # Maven Wrapper（可选但推荐）
├── lefthook.yml
├── config/
│   ├── checkstyle/checkstyle.xml
│   ├── pmd/ruleset.xml
│   └── spotbugs/exclude.xml
├── tools/crap/Crap.java                # 工程脚本（CRAP），非运行期代码
└── src/
    ├── main/java/com/example/app/
    │   ├── AppApplication.java         # 仅 @SpringBootApplication 启动类（组合根）
    │   ├── interfaces/                 # 接口层：web/(@RestController)、cli、消息入口
    │   ├── application/                # 应用层：service/、command/、query/、dto/（用例编排）
    │   ├── domain/                     # 领域层：model/、event/、port/（纯抽象，不依赖框架）
    │   └── infrastructure/             # 基础设施层：persistence/、client/、config/（实现 domain.port）
    ├── main/resources/
    └── test/java/com/example/app/
        ├── unit/
        ├── integration/
        ├── e2e/
        └── archunit/                   # ArchUnit 架构测试
```

**依赖方向（DDD / 端口-适配器）**

```text
interfaces ──▶ application ──▶ domain ◀── infrastructure
```

- `interfaces → application → domain` 单向；反向禁止。
- `infrastructure → domain`：实现领域定义的端口（仓储/网关接口）。
- `domain` 不依赖任何其他层，也不依赖 Spring / 数据库 / 网络。

**约束条目**

1. **业务根唯一**：所有运行期代码在 `com.example.app` 下；启动类 `AppApplication` 只放 `@SpringBootApplication`。
2. **分层方向**：见上；`interfaces` / `application` / `domain` 不得导入 `infrastructure`（依赖倒置：内层不知道外层适配器）。
3. **组合根唯一**：`AppApplication` / `@Configuration` 只负责装配 Bean，不放业务逻辑。
4. **领域纯净**：`domain` 与 `application` 不得导入 `org.springframework.*` / `javax.persistence.*`；请求上下文只出现在 `interfaces` 层。
5. **测试镜像分层**：`tests/unit` 纯函数、`tests/integration` 起 Spring 上下文、`tests/e2e` 真实 HTTP + Testcontainers。
6. **工程脚本隔离**：`tools/` 不进运行期产物（不放在 `src/main/java`），由 `exec-maven-plugin` 按单文件源码启动。
7. **生成物不手改 / 不 lint / 不入覆盖率**：`target/`、`coverage/`、`crap-report/`、`playwright-report/`。

**约束 → 落实位置**

| 约束 | 落实位置 |
|---|---|
| 业务根唯一 | Maven 默认 `src/main/java`；Checkstyle `PackageName` / `RegexpHeader`（§6.3） |
| 分层方向 + DIP | ArchUnit `layeredArchitecture` / `noClasses().that().resideInAPackage`（§6.7） |
| 领域/应用层不绑框架 | ArchUnit `noClasses().should().dependOnClassesThat().resideInAnyPackage("org.springframework..")`（§6.7） |
| 测试分层 | Maven surefire / failsafe 命名与阶段（§6.1、§6.8） |
| 脚本不打包 | `tools/` 不在 `src/main/java`（§6.9） |
| 生成物 | `.gitignore` + 各工具 exclude（§6.12） |

> 设计约束（S/O/L/I/D）中的 **D（依赖倒置）与 I（接口隔离）** 可落成 ArchUnit 的确定性契约；**O（开闭）与 L（里氏替换）** 无自动规则（见 §7、§13）。
>
> 目录的「存在性」本身不被工具强制（空目录不会报错）；ArchUnit 只约束**已存在类**之间的依赖关系。多限界上下文时，可按上下文包各建一套四层（本文默认单上下文，见 §13）。

## 3. 分层总览

| 层 | 工具 | 职责 | 许可证 |
|---|---|---|---|
| 格式化 | `spotless`（+ google-java-format） | 代码格式化（对标 Prettier） | Apache-2.0 |
| 风格 / 命名 / 体量 | `checkstyle` | 命名、导入、空块、文件/方法行数、参数个数 | **LGPL-2.1** |
| 坏味道 / 复杂度 / 克隆 | `pmd`（`design` / `errorprone` / `bestpractices` / `codestyle`）+ CPD | 认知/圈复杂度、NPath、超长方法/类、上帝类、复制粘贴检测 | BSD-4-Clause |
| 缺陷检测 | `spotbugs`（+ `find-sec-bugs`） | 字节码级缺陷、安全白盒 | **LGPL-2.1** / **LGPL-3.0** |
| 类型 / 编译期近似 | `error-prone`（+ `nullaway` 可选） | 编译期正确性检查（对标 TS type-aware） | Apache-2.0 / MIT |
| 架构 / 依赖边界 | `archunit` | 分层、禁跨层、无环、切片独立性 | Apache-2.0 |
| 测试 / 覆盖率 | `junit5` + `assertj` + `mockito` + `jacoco` | 单元/集成测试、覆盖率 | EPL-2.0 / Apache-2.0 / MIT / EPL-2.0 |
| Spring 端到端 | `junit5` + `spring-boot-test` + `rest-assured` + `testcontainers` | 真实 HTTP、真实依赖 | 见上 / Apache-2.0 / Apache-2.0 / MIT |
| CRAP | `jacoco`（自算 Java 工具） | 复杂度 × 覆盖率门禁 | EPL-2.0 |
| 安全与依赖卫生 | `find-sec-bugs` + `dependency-check` + `maven-dependency-plugin` | 安全白盒、依赖漏洞、依赖卫生 | LGPL-3.0 / Apache-2.0 / Apache-2.0 |
| Git 钩子 | `lefthook` | pre-commit 快修 + pre-push 强门禁 | MIT |
| 任务载体 | Maven（`./mvnw`） | 以 Maven 命令命名（对标 npm scripts） | Apache-2.0 |
| CRAP 执行器 | `exec-maven-plugin` | 在 `verify` 阶段调用自制 CRAP 工具 | Apache-2.0 |

> 运行期框架 `spring-boot` 本身不是质量工具，未列入本表，仅作为被测对象。
>
> **许可证提醒**：Checkstyle（LGPL-2.1）、SpotBugs（LGPL-2.1）、find-sec-bugs（LGPL-3.0）是**构建期工具**，一般不链接进发布产物，商用合规风险通常可控，但仍需按团队法务惯例确认（见 §13）。

## 4. 依赖与许可证清单（版本于 2026-09-29 核实）

| 包 / 工具 | 版本 | 许可证 | 核实 |
|---|---|---|---|
| `pmd` | 7.28.0 | BSD-4-Clause | 已核实 |
| `checkstyle` | 14.3.0 | **LGPL-2.1** | 已核实 |
| `spotbugs` | 4.10.4 | **LGPL-2.1** | 已核实 |
| `findsecbugs-plugin` | 1.14.0 | **LGPL-3.0** | 已核实 |
| `error-prone` | 2.50.0 | Apache-2.0 | 已核实 |
| `nullaway` | 0.14.2（可选） | MIT | 已核实 |
| `spotless` | 8.10.3 | Apache-2.0 | 已核实 |
| `google-java-format` | 未核实 | Apache-2.0 | 未核实 |
| `archunit-junit5` | 未核实 | Apache-2.0 | 未核实 |
| `junit-jupiter` | 5.13.x（Java 8 线） | EPL-2.0 | 已核实（线） |
| `assertj-core` | 3.27.x | Apache-2.0 | 已核实（线） |
| `mockito-core` | 4.11.0 | MIT | 已核实 |
| `jacoco-maven-plugin` | 0.8.12+（最新 0.8.15） | EPL-2.0 | 已核实 |
| `testcontainers` | 1.x 线 | MIT | 已核实（线） |
| `rest-assured` | 5.x | Apache-2.0 | 已核实（线） |
| `dependency-check-maven` | 未核实 | Apache-2.0 | 未核实 |
| `maven-dependency-plugin` | Spring Boot BOM 管理 | Apache-2.0 | — |
| `spring-boot-starter-parent` | **2.7.18** | Apache-2.0 | 已核实 |
| `lefthook` | 未核实 | MIT | 未核实 |
| `exec-maven-plugin` | 未核实 | Apache-2.0 | 未核实 |

> **版本策略**：表内「已核实」的**工具库版本**按 2026-09-29 的官方发布页核实；**未核实**的多为 Maven **插件包装版本**或会随项目变动的库，必须在目标项目用 Maven Central / 官方文档现场锁定，**不要照抄**。工具库版本与 Maven 插件版本是两个概念（例如 `maven-checkstyle-plugin` 的版本 ≠ `checkstyle` 库的版本，后者通过插件 `<dependency>` 覆盖）。
>
> JUnit / Mockito / AssertJ 的实际版本由 **Spring Boot 2.7.18 的依赖管理（BOM）** 决定（均为 Java 8 兼容），上表给的是「可用上限线」；如需更高版本，按 §2.2 回退表核对 Java 8 兼容性。

## 5. 接入命令

```bash
# 1) 加 Maven Wrapper（若尚无），之后统一用 ./mvnw
mvn -N wrapper:wrapper -Dmaven=3.9.9

# 2) 声明 Java 8 语言级别（pom.xml，见 §2.1）
#    <maven.compiler.release>8</maven.compiler.release>

# 3) 测试依赖（版本由 Spring Boot 2.7.18 BOM 管理；显式覆盖时按 §2.2 选 Java 8 兼容线）
#    junit-jupiter / assertj-core / mockito-core / testcontainers-junit-jupiter / rest-assured
#    （均为 test scope）

# 4) 构建期质量工具：通过各 Maven 插件引入，不进入运行期 classpath
#    - spotless-maven-plugin          （格式化，§6.2）
#    - maven-checkstyle-plugin        （风格/体量，§6.3）
#    - maven-pmd-plugin               （坏味道/复杂度/CPD，§6.4）
#    - spotbugs-maven-plugin          （缺陷，§6.5）
#    - maven-compiler-plugin + error_prone_core（编译期，§6.6）
#    - archunit-junit5                （架构测试，§6.7）
#    - jacoco-maven-plugin            （覆盖率，§6.8）
#    - exec-maven-plugin              （CRAP，§6.9）
#    - dependency-check-maven + maven-dependency-plugin（安全/依赖，§6.10）

# 5) Git 钩子（跨平台，Windows 有原生二进制）
#    安装 lefthook 二进制后：
lefthook install
```

## 6. 可复制配置

> 下列 `pom.xml` 片段中，**已由 `spring-boot-starter-parent` 管理的插件（compiler / surefire / failsafe / jacoco / resources）无需写 `<version>`**；未管理的插件版本须按 §4「版本策略」现场锁定。

### 6.1 `pom.xml` 顶层骨架

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0" ...>
  <modelVersion>4.0.0</modelVersion>

  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>2.7.18</version>
    <relativePath/>
  </parent>

  <groupId>com.example</groupId>
  <artifactId>app</artifactId>
  <version>0.1.0-SNAPSHOT</version>

  <properties>
    <java.version>1.8</java.version>
    <maven.compiler.release>8</maven.compiler.release>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    <!-- CRAP 门禁开关：false=只出报告；true=超阈值即失败 -->
    <crap.fail>false</crap.fail>
    <crap.threshold>6</crap.threshold>
  </properties>

  <!-- 依赖见 §5；测试依赖均 test scope -->

  <build>
    <plugins>
      <!-- 见 §6.2 ~ §6.10 -->
    </plugins>
  </build>
</project>
```

### 6.2 Spotless（格式化，对标 Prettier）

```xml
<plugin>
  <groupId>com.diffplug.spotless</groupId>
  <artifactId>spotless-maven-plugin</artifactId>
  <version>8.10.3</version>
  <configuration>
    <java>
      <!-- 版本以 Spotless 文档支持的为准；可用 palantirJavaFormat() 替换 -->
      <googleJavaFormat/>
      <removeUnusedImports/>
      <trimTrailingWhitespace/>
      <endWithNewline/>
    </java>
  </configuration>
  <executions>
    <execution>
      <id>spotless-check</id>
      <phase>verify</phase>
      <goals><goal>check</goal></goals>
    </execution>
  </executions>
</plugin>
```

> `spotless:apply` 用于自动修复（pre-commit），`spotless:check` 用于门禁（push 前）。必要时可用 `-DspotlessFiles=` 限定文件（以插件文档为准）。

### 6.3 Checkstyle（命名 / 导入 / 空块 / 体量）

`config/checkstyle/checkstyle.xml`（节选，最终以官方规则名为准）：

```xml
<?xml version="1.0"?>
<!DOCTYPE module PUBLIC "-//Checkstyle//DTD Checkstyle Configuration 1.3//EN"
  "https://checkstyle.org/dtds/configuration_1_3.dtd">
<module name="Checker">
  <property name="charset" value="UTF-8"/>
  <property name="severity" value="warning"/>

  <module name="LineLength">
    <property name="max" value="120"/>
  </module>
  <module name="FileLength">
    <property name="max" value="400"/>
  </module>

  <module name="TreeWalker">
    <!-- 命名 -->
    <module name="PackageName"/>
    <module name="TypeName"/>
    <module name="MethodName"/>
    <module name="MemberName"/>
    <module name="ConstantName"/>
    <module name="LocalVariableName"/>
    <module name="ParameterName"/>

    <!-- 导入 -->
    <module name="UnusedImports"/>
    <module name="RedundantImport"/>
    <module name="AvoidStarImport"/>

    <!-- 体量 -->
    <module name="MethodLength">
      <property name="max" value="100"/>
    </module>
    <module name="ParameterNumber">
      <property name="max" value="4"/>
    </module>

    <!-- 空实现 / 被吞异常 -->
    <module name="NeedBraces"/>
    <module name="EmptyBlock">
      <property name="option" value="text"/>
    </module>
    <module name="EmptyCatchBlock">
      <property name="exceptionVariableName" value="expected"/>
    </module>
  </module>
</module>
```

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-checkstyle-plugin</artifactId>
  <version><!-- 以 Maven Central 为准 --></version>
  <configuration>
    <configLocation>config/checkstyle/checkstyle.xml</configLocation>
    <consoleOutput>true</consoleOutput>
    <failOnViolation>true</failOnViolation>
    <violationSeverity>warning</violationSeverity>
    <includeTestSourceDirectory>true</includeTestSourceDirectory>
  </configuration>
  <dependencies>
    <!-- 覆盖插件内置的 checkstyle 版本，锁定 §4 的 14.3.0 -->
    <dependency>
      <groupId>com.puppycrawl.tools</groupId>
      <artifactId>checkstyle</artifactId>
      <version>14.3.0</version>
    </dependency>
  </dependencies>
  <executions>
    <execution>
      <id>checkstyle-check</id>
      <phase>verify</phase>
      <goals><goal>check</goal></goals>
    </execution>
  </executions>
</plugin>
```

### 6.4 PMD（坏味道 / 复杂度 / 克隆）

`config/pmd/ruleset.xml`（节选；PMD 7 规则名以官方文档为准）：

```xml
<?xml version="1.0"?>
<ruleset name="app"
  xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0
    https://pmd.sourceforge.io/ruleset_2_0_0.xsd">
  <description>项目规则集</description>

  <rule ref="category/java/errorprone.xml"/>
  <rule ref="category/java/bestpractices.xml"/>
  <rule ref="category/java/codestyle.xml"/>

  <rule ref="category/java/design.xml/CyclomaticComplexity">
    <properties><property name="classReportLevel" value="80"/>
                <property name="methodReportLevel" value="20"/></properties>
  </rule>
  <rule ref="category/java/design.xml/CognitiveComplexity">
    <properties><property name="reportLevel" value="20"/></properties>
  </rule>
  <rule ref="category/java/design.xml/NPathComplexity"/>
  <rule ref="category/java/design.xml/ExcessiveMethodLength">
    <properties><property name="minimum" value="100"/></properties>
  </rule>
  <rule ref="category/java/design.xml/ExcessiveClassLength"/>
  <rule ref="category/java/design.xml/TooManyMethods"/>
  <rule ref="category/java/design.xml/ExcessiveParameterList"/>
  <rule ref="category/java/design.xml/CouplingBetweenObjects"/>
</ruleset>
```

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-pmd-plugin</artifactId>
  <version><!-- 以 Maven Central 为准 --></version>
  <configuration>
    <rulesets>
      <ruleset>config/pmd/ruleset.xml</ruleset>
    </rulesets>
    <failOnViolation>true</failOnViolation>
    <printFailingErrors>true</printFailingErrors>
    <includeTests>false</includeTests>
    <!-- CPD：复制粘贴检测 -->
    <cpd>
      <minimumTokens>100</minimumTokens>
      <ignoreIdentifiers>true</ignoreIdentifiers>
      <ignoreLiterals>true</ignoreLiterals>
    </cpd>
  </configuration>
  <executions>
    <execution>
      <id>pmd-check</id>
      <phase>verify</phase>
      <goals>
        <goal>check</goal>
        <goal>cpd-check</goal>
      </goals>
    </execution>
  </executions>
</plugin>
```

> PMD 的 CPD 检测**跨方法/跨文件代码克隆**，补齐了 Python 版工具链无法覆盖的克隆检测缺口（见 §7）。

### 6.5 SpotBugs + find-sec-bugs（缺陷 + 安全白盒）

`config/spotbugs/exclude.xml`（可选）：

```xml
<?xml version="1.0"?>
<FindBugsFilter>
  <!-- 生成代码 / 测试夹具按需排除 -->
</FindBugsFilter>
```

```xml
<plugin>
  <groupId>com.github.spotbugs</groupId>
  <artifactId>spotbugs-maven-plugin</artifactId>
  <version><!-- 以 Maven Central 为准 --></version>
  <configuration>
    <effort>Max</effort>
    <threshold>Medium</threshold>
    <failOnError>true</failOnError>
    <excludeFilterFile>config/spotbugs/exclude.xml</excludeFilterFile>
  </configuration>
  <dependencies>
    <!-- 安全规则包（与 SpotBugs 4.8.x 配套时用 1.13.0，见 §2.2） -->
    <dependency>
      <groupId>com.h3xstream.findsecbugs</groupId>
      <artifactId>findsecbugs-plugin</artifactId>
      <version>1.14.0</version>
    </dependency>
  </dependencies>
  <executions>
    <execution>
      <id>spotbugs-check</id>
      <phase>verify</phase>
      <goals><goal>check</goal></goals>
    </execution>
  </executions>
</plugin>
```

### 6.6 Error Prone（+ NullAway，编译期，Phase 2 起）

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-compiler-plugin</artifactId>
  <configuration>
    <release>${maven.compiler.release}</release>
    <compilerArgs>
      <arg>-XDcompilePolicy=simple</arg>
      <arg>-Xplugin:ErrorProne</arg>
      <!-- Error Prone 需要这些 JVM 导出（随构建 JDK 版本调整） -->
      <arg>-J--add-exports=jdk.compiler/com.sun.tools.javac.api=ALL-UNNAMED</arg>
      <arg>-J--add-exports=jdk.compiler/com.sun.tools.javac.file=ALL-UNNAMED</arg>
      <arg>-J--add-exports=jdk.compiler/com.sun.tools.javac.parser=ALL-UNNAMED</arg>
      <arg>-J--add-exports=jdk.compiler/com.sun.tools.javac.tree=ALL-UNNAMED</arg>
      <arg>-J--add-exports=jdk.compiler/com.sun.tools.javac.util=ALL-UNNAMED</arg>
    </compilerArgs>
    <annotationProcessorPaths>
      <path>
        <groupId>com.google.errorprone</groupId>
        <artifactId>error_prone_core</artifactId>
        <version>2.50.0</version>
      </path>
      <!-- 可选：NullAway（需配套 @Nullable 注解库） -->
      <!--
      <path>
        <groupId>com.uber.nullaway</groupId>
        <artifactId>nullaway</artifactId>
        <version>0.14.2</version>
      </path>
      -->
    </annotationProcessorPaths>
  </configuration>
</plugin>
```

> **诚实提醒**：Error Prone 的 Maven 集成**依赖具体构建 JDK 版本**（`--add-exports` 会随 JDK 变化），且对 Lombok 等注解处理器可能冲突。建议**放到 Phase 2/3** 再启用（§11）；**情形 B（纯 JDK 8）不启用**（§2.2）。

### 6.7 ArchUnit（架构 / 依赖边界，对标 FSD steiger + import-linter）

`src/test/java/com/example/app/archunit/ArchitectureTest.java`：

```java
package com.example.app.archunit;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import com.tngtech.archunit.library.Architectures;
import com.tngtech.archunit.lang.syntax.ArchRuleDefinition;

@AnalyzeClasses(
    packages = "com.example.app",
    importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {

  @ArchTest
  static final ArchRule layers = Architectures.layeredArchitecture()
      .consideringAllDependencies()
      .layer("Interfaces").definedBy("..interfaces..")
      .layer("Application").definedBy("..application..")
      .layer("Domain").definedBy("..domain..")
      .layer("Infrastructure").definedBy("..infrastructure..")
      .whereLayer("Interfaces").mayNotBeAccessedByAnyLayer()
      .whereLayer("Application").mayOnlyBeAccessedByLayers("Interfaces")
      .whereLayer("Domain").mayOnlyBeAccessedByLayers(
          "Interfaces", "Application", "Infrastructure")
      .whereLayer("Infrastructure").mayNotBeAccessedByAnyLayer();

  @ArchTest
  static final ArchRule domain_application_are_framework_free =
      ArchRuleDefinition.noClasses()
          .that().resideInAnyPackage("..application..", "..domain..")
          .should().dependOnClassesThat()
          .resideInAnyPackage(
              "org.springframework..",
              "javax.persistence..",
              "jakarta.persistence..");

  @ArchTest
  static final ArchRule no_cycles =
      ArchRuleDefinition.slices()
          .matching("com.example.app.(*)..")
          .should().beFreeOfCycles();
}
```

```xml
<dependency>
  <groupId>com.tngtech.archunit</groupId>
  <artifactId>archunit-junit5</artifactId>
  <version><!-- 以 Maven Central 为准 --></version>
  <scope>test</scope>
</dependency>
```

> ArchUnit 1.x **仍支持 Java 8**（§2.2）。`layeredArchitecture().consideringAllDependencies()` 为 ArchUnit 1.0+ 写法；升级前核对该版本 API。

### 6.8 JaCoCo（覆盖率，供 CRAP 用）

```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <executions>
    <execution>
      <id>prepare-agent</id>
      <goals><goal>prepare-agent</goal></goals>
    </execution>
    <execution>
      <id>report</id>
      <phase>verify</phase>
      <goals><goal>report</goal></goals>
      <configuration>
        <!-- CRAP 工具读取 XML；同时输出 CSV/HTML 供人看 -->
        <formats>
          <format>XML</format>
          <format>CSV</format>
          <format>HTML</format>
        </formats>
      </configuration>
    </execution>
  </executions>
</plugin>
```

> JaCoCo 输出位于 `target/site/jacoco/jacoco.xml`。**JaCoCo 直接为每个非抽象方法计算圈复杂度（`COMPLEXITY` 计数器）**，因此 CRAP 可只依赖 JaCoCo，无需 PMD（见 §6.9、§12）。

### 6.9 CRAP 工具（Java，单文件源码启动）

**公式**：`CRAP = 复杂度² × (1 − 覆盖率)³ + 复杂度`，复杂度取 JaCoCo 方法级 `COMPLEXITY`（covered + missed），覆盖率取方法级 `INSTRUCTION` covered / (covered + missed)。

`tools/crap/Crap.java`：

```java
package crap;

import java.io.File;
import java.util.Locale;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/** CRAP = complexity^2 * (1 - coverage)^3 + complexity。仅依赖 JDK，无需第三方库。 */
public final class Crap {

  public static void main(String[] args) throws Exception {
    if (args.length < 1) {
      System.err.println("用法: Crap <jacoco.xml> [threshold=6] [failAbove=false]");
      System.exit(2);
    }
    File xml = new File(args[0]);
    if (!xml.isFile()) {
      System.err.println("[crap] 找不到 JaCoCo 报告: " + xml.getAbsolutePath());
      System.exit(2);
    }
    double threshold = args.length > 1 ? Double.parseDouble(args[1]) : 6.0;
    boolean failAbove = args.length > 2 && Boolean.parseBoolean(args[2]);

    Document doc = newBuilder().parse(xml);
    NodeList classes = doc.getElementsByTagName("class");

    int over = 0;
    int methods = 0;
    double worst = 0.0;
    String worstAt = "";

    for (int i = 0; i < classes.getLength(); i++) {
      Element cls = (Element) classes.item(i);
      String clsName = cls.getAttribute("name");
      NodeList ms = cls.getElementsByTagName("method");
      for (int j = 0; j < ms.getLength(); j++) {
        Element m = (Element) ms.item(j);
        int cc = counterSum(m, "COMPLEXITY");
        if (cc == 0) {           // 抽象/接口/合成方法，跳过
          continue;
        }
        double coverage = counterRatio(m, "INSTRUCTION");
        double crap = cc * cc * Math.pow(1.0 - coverage, 3) + cc;
        methods++;
        if (crap > worst) {
          worst = crap;
          worstAt = clsName + "#" + m.getAttribute("name");
        }
        if (crap > threshold) {
          over++;
          System.out.printf(Locale.ROOT,
              "CRAP %6.1f  %s#%s (cc=%d, cov=%.0f%%)%n",
              crap, clsName, m.getAttribute("name"), cc, coverage * 100.0);
        }
      }
    }

    System.out.printf(Locale.ROOT,
        "[crap] 方法数=%d，阈值=%.1f，超限=%d，最高=%.1f (%s)%n",
        methods, threshold, over, worst, worstAt);

    if (over > 0 && failAbove) {
      System.exit(1);
    }
  }

  private static DocumentBuilder newBuilder() throws Exception {
    DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
    f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    f.setXIncludeAware(false);
    f.setExpandEntityReferences(false);
    return f.newDocumentBuilder();
  }

  /** JaCoCo 计数器 = covered + missed（如 COMPLEXITY）。 */
  private static int counterSum(Element scope, String type) {
    NodeList cs = scope.getElementsByTagName("counter");
    for (int k = 0; k < cs.getLength(); k++) {
      Element c = (Element) cs.item(k);
      if (type.equals(c.getAttribute("type"))) {
        return intOf(c.getAttribute("covered")) + intOf(c.getAttribute("missed"));
      }
    }
    return 0;
  }

  /** JaCoCo 覆盖率 = covered / (covered + missed)；无计数时视为已覆盖。 */
  private static double counterRatio(Element scope, String type) {
    NodeList cs = scope.getElementsByTagName("counter");
    for (int k = 0; k < cs.getLength(); k++) {
      Element c = (Element) cs.item(k);
      if (type.equals(c.getAttribute("type"))) {
        int covered = intOf(c.getAttribute("covered"));
        int total = covered + intOf(c.getAttribute("missed"));
        return total == 0 ? 1.0 : (double) covered / total;
      }
    }
    return 1.0;
  }

  private static int intOf(String s) {
    return s == null || s.isEmpty() ? 0 : Integer.parseInt(s);
  }

  private Crap() {
  }
}
```

`exec-maven-plugin` 绑定（用 JDK 11+ 的**单文件源码启动**，无需把工具类编进产物）：

```xml
<plugin>
  <groupId>org.codehaus.mojo</groupId>
  <artifactId>exec-maven-plugin</artifactId>
  <version><!-- 以 Maven Central 为准 --></version>
  <executions>
    <execution>
      <id>crap-gate</id>
      <phase>verify</phase>
      <goals><goal>exec</goal></goals>
      <configuration>
        <executable>java</executable>
        <arguments>
          <argument>${project.basedir}/tools/crap/Crap.java</argument>
          <argument>${project.build.directory}/site/jacoco/jacoco.xml</argument>
          <argument>${crap.threshold}</argument>
          <argument>${crap.fail}</argument>
        </arguments>
        <!-- 单文件源码启动的隐式类名与 fileName 一致 -->
      </configuration>
    </execution>
  </executions>
</plugin>
```

> **为什么用 JaCoCo 而非 PMD 算复杂度**：JaCoCo XML 已含方法级 `COMPLEXITY`，省掉 PMD↔JaCoCo 的方法签名匹配（重载、合成方法、Lombok/Kotlin 易错），风险更低（见 §12）。
>
> **已知近似**：JaCoCo 的圈复杂度**不计 try/catch 分支**，与 PMD 的复杂度口径略有差异；`.java` 单文件启动要求**构建 JDK ≥ 11**（情形 A 满足；情形 B 需改为先 `javac` 再 `java`，见 §13）。
>
> **体量不重复检测**：文件/方法行数、参数个数由 Checkstyle 负责（§6.3），CRAP 工具只算 CRAP。

### 6.10 安全与依赖卫生

```xml
<plugin>
  <groupId>org.owasp</groupId>
  <artifactId>dependency-check-maven</artifactId>
  <version><!-- 以 Maven Central 为准 --></version>
  <configuration>
    <failBuildOnCVSS>7</failBuildOnCVSS>
  </configuration>
  <executions>
    <execution>
      <id>owasp-check</id>
      <phase>verify</phase>
      <goals><goal>check</goal></goals>
    </execution>
  </executions>
</plugin>

<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-dependency-plugin</artifactId>
  <executions>
    <execution>
      <id>analyze</id>
      <phase>verify</phase>
      <goals><goal>analyze-only</goal></goals>
      <configuration>
        <failOnWarning>true</failOnWarning>
        <!-- 未声明（used-undeclared）与未使用（unused-declared）依赖 -->
        <ignoredUnusedDeclaredDependencies/>
        <ignoredNonTestScopedDependencies/>
      </configuration>
    </execution>
  </executions>
</plugin>
```

> OWASP dependency-check 当前线要求 **JDK 11+** 运行（情形 A 满足；情形 B 只能到 8.4.3，不建议，§2.2）。它做的是**依赖漏洞**扫描；`maven-dependency-plugin:analyze-only` 做的是**依赖卫生**（幻影/未用依赖），二者互补。

### 6.11 lefthook（pre-commit 快修 + pre-push 门禁）

`lefthook.yml`：

```yaml
pre-commit:
  parallel: true
  commands:
    spotless:
      glob: "*.java"
      run: ./mvnw -q spotless:apply
    # 可选：把改动的 java 文件交给 Checkstyle（若插件支持文件级过滤）
    # checkstyle:
    #   glob: "*.java"
    #   run: ./mvnw -q checkstyle:check -Dcheckstyle.includes={staged_files}

pre-push:
  commands:
    gate:
      run: ./mvnw -q -Dcrap.fail=true verify
```

> **为什么不把 Checkstyle/PMD 放进 pre-commit**：它们只检查、不自动修复，逐次全量跑太慢；放入 `pre-push` 的 `verify` 更合适。`pre-commit` 只做**能自动修**的 Spotless。
>
> `lefthook install` 写入/接管 `.git/hooks`；跨平台（含 Windows 原生二进制），无需 node / Python。

### 6.12 忽略文件

`.gitignore`：

```text
target/
coverage/
crap-report/
*.class
.mvn/wrapper/maven-wrapper.jar
```

> Maven 无 `.prettierignore` / `.stylelintignore` 的等价物；Spotless / Checkstyle / PMD 通过各自 `<excludes>` 或 `excludeFilterFile` 排除生成物（`target/` 默认不在源码扫描范围内）。

## 7. 规则 → 症状 / 目标映射表

| 目标 | 落实方式 | 状态 |
|---|---|---|
| 未解析导入（幻影导入） | `maven-compiler-plugin`（编译失败）+ `maven-dependency-plugin:analyze-only`（used-undeclared） | **已配置**（§6.1、§6.10） |
| 被吞异常 | Checkstyle `EmptyCatchBlock`；PMD `errorprone`（`EmptyCatchBlock`） | **已配置** |
| 空实现 / 假完成桩 | Checkstyle `EmptyBlock`；PMD `codestyle`/`bestpractices` | **部分覆盖**（语义假实现无法可靠检测） |
| 大文件 | Checkstyle `FileLength`（400） | **已配置**（§6.3） |
| 大方法 | Checkstyle `MethodLength`（100）；PMD `ExcessiveMethodLength` | **已配置** |
| 上帝类 | PMD `ExcessiveClassLength` / `TooManyMethods` / `CouplingBetweenObjects` | **已配置**（§6.4） |
| 长参数列表 | Checkstyle `ParameterNumber`（4）；PMD `ExcessiveParameterList` | **已配置** |
| 重复 / 复制粘贴 | PMD **CPD**（`cpd-check`） | **已配置**（跨方法/跨文件克隆） |
| 复杂度（圈） | PMD `CyclomaticComplexity`（方法 20） | **已配置** |
| 认知复杂度 | PMD `CognitiveComplexity`（20，PMD 7 内置） | **已配置** |
| NPath 复杂度 | PMD `NPathComplexity` | **已配置** |
| 架构分层错乱 / 跨层导入 | ArchUnit `layeredArchitecture` | **已配置**（§6.7） |
| 领域/应用层绑框架 | ArchUnit `noClasses().should().dependOnClassesThat()` | **已配置** |
| 循环依赖 | ArchUnit `slices().should().beFreeOfCycles()` | **已配置** |
| 类型 / 常见错误 | `error-prone`（编译期） | **Phase 2/3**（§6.6、§11） |
| 缺陷（字节码级） | `spotbugs`（effort Max / threshold Medium） | **已配置**（§6.5） |
| 安全问题 | `find-sec-bugs` | **已配置** |
| 依赖漏洞 | `dependency-check-maven` | **已配置**（§6.10） |
| 依赖卫生（未用/未声明） | `maven-dependency-plugin:analyze-only` | **已配置** |
| 格式化不一致 | `spotless:check` | **已配置** |
| AI 味调试残留 | PMD `bestpractices`（`SystemPrintln` 等，按需）；Error Prone（Phase 2/3） | **部分覆盖** |
| 叙述性注释（AI 味注释） | —— | **未覆盖**（§13） |
| 样式 / 设计 token | —— | **不适用**（Java 后端，§13） |

### SOLID 逐条覆盖（诚实说明：SOLID 是设计原则，无工具能直接检查）

| 原则 | 近似手段 |
|---|---|
| S 单一职责 | PMD `CyclomaticComplexity` / `CognitiveComplexity` / `ExcessiveMethodLength` / `ExcessiveClassLength` / `TooManyMethods`；CPD |
| O 开闭 | **无自动规则**（评审 + 测试） |
| L 里氏替换 | **无自动规则**（评审 + 测试） |
| I 接口隔离 | ArchUnit 分层 + 领域端口（`domain/port`）的依赖面约束 |
| D 依赖倒置 | ArchUnit `layeredArchitecture`（`interfaces/application/domain` 不得依赖 `infrastructure`） |

## 8. 测试与 CRAP

### 8.1 分层

- **单元**：纯函数/工具，JUnit 5 + AssertJ。
- **集成**：`@SpringBootTest` 起上下文，Mockito 隔离外部依赖；真实文件/子进程。
- **端到端**：`@SpringBootTest(webEnvironment = RANDOM_PORT)` + **REST Assured** 打真实 HTTP；**Testcontainers** 起真实 DB/中间件（无浏览器依赖；浏览器 E2E 见 §13）。

端到端骨架：

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ReportE2ETest {

  @LocalServerPort
  int port;

  @Test
  void create_then_read_report() {
    given()
        .port(port)
        .contentType(ContentType.JSON)
        .body("{\"name\":\"demo\"}")
    .when()
        .post("/api/reports")
    .then()
        .statusCode(201)
        .body("name", equalTo("demo"));
  }
}
```

> Testcontainers 的 Java 8 兼容线见 §2.2；有真实容器依赖时，集成测试用 `@Testcontainers` 管理生命周期。

### 8.2 CRAP 门禁

- **公式**：`CRAP = 复杂度² × (1 − 覆盖率)³ + 复杂度`；复杂度取 JaCoCo 方法级 `COMPLEXITY`。
- **输入**：`target/site/jacoco/jacoco.xml`（由 `jacoco:report` 产生）。
- **工具**：`tools/crap/Crap.java`（自制，仅依赖 JDK，§6.9）。
- **阈值：≤ 6**。这是**本方案采用的严格工程政策**：经典 CRAP 常见风险线是 30，Uncle Bob 在 AI 辅助测试时代主张把函数压到 6 以下；二者必须区分，不要把 6 说成「行业标准」。
- **命令**：`./mvnw verify -Dcrap.fail=true`（超阈值即失败）；只出报告用 `./mvnw verify`（默认 `crap.fail=false`）。

### 8.3 渐进策略

仓库初始测试极少时，直接设死阈值会全线爆红。策略：

1. 复杂度先放宽（PMD `CyclomaticComplexity` 20 / `CognitiveComplexity` 20）；
2. 覆盖率**先只出报告**（不设全局阈值），CRAP 只出报告（`crap.fail=false`）；
3. 补测试 → 逐步把复杂度收到 15、把 CRAP 阈值收紧到 6 并转为硬门禁（`crap.fail=true`）；
4. 存量超标收敛后，把 Checkstyle/PMD 的体量规则由 `warning` 升为 `error`。

## 9. 本地门禁流程（无 CI）

### 9.1 `pre-commit`（快速反馈）
`lefthook`：对暂存的 `.java` 跑 `./mvnw spotless:apply`（自动修复格式）。

### 9.2 `push` 之前（强门禁）
`pre-push` 调用 `./mvnw -Dcrap.fail=true verify`，即：`spotless:check` + `checkstyle:check` + `pmd:check` + `pmd:cpd-check` + `spotbugs:check` + 编译 + `surefire`（单元/集成）+ `failsafe`（E2E）+ `jacoco:report` + `exec:exec`（CRAP）+ `dependency-check:check` + `dependency:analyze-only`。失败即中止，符合「问题在 push 前本地处理」。

> **阶段演进**：Phase 1 的 `prepush` 用 `-Dcrap.fail=false`（只出报告）；测试补齐后改为 `-Dcrap.fail=true`（§11）。

### 9.3 端到端（不进门禁）
`./mvnw failsafe:integration-test` 单独运行，在发 PR 前手动执行；需要容器时确保 Docker 可用。

### 9.4 mutation testing（不定时，非门禁）
变异测试（如 **PIT / pitest**）迁移成本高、耗时，**不属于本门禁**，按需（如版本发布前、专项加固时）不定期执行。本文档不展开（见 §13）。

## 10. 接入 AI 工作流

本地开发已由 AI 驱动，因此把上述命令按「任务阶段」绑定：AI 每完成一个阶段就调用对应命令，而不是等到最后。

### 10.1 阶段 → 命令

| 阶段 | 动作 | 命令 |
|---|---|---|
| 探索 / 设计 | 只读、不改码 | 不跑门禁 |
| 实现中（改动未稳定） | 只跑**受影响**的最小检查 | `./mvnw spotless:apply`、`./mvnw -Dtest=SomeTest test`、`./mvnw compile` |
| 一个阶段/子任务完成 | 全量静态 + 测试 | `./mvnw verify -Ddependency-check.skip=true`（跳过慢的漏洞库同步） |
| 收尾（提交前） | 完整本地门禁 | `./mvnw -Dcrap.fail=true verify` |
| 涉及接口/交互 | 端到端 | `./mvnw failsafe:integration-test` |
| 架构 / 包结构改动 | 架构边界 | `./mvnw -Dtest=ArchitectureTest test` |
| 依赖变动 | 依赖卫生 + 漏洞 | `./mvnw dependency:analyze-only`、`./mvnw dependency-check:check` |
| 不定时 | mutation | 按需，非门禁 |

### 10.2 可复制到 `AGENTS.md` 的片段

```md
## 项目结构：DDD 四层（端口-适配器）

层只能单向依赖：interfaces → application → domain ← infrastructure；
application/domain 不得依赖 infrastructure，也不得依赖 Spring/JPA；
domain 不依赖任何其他层。改动包结构后必须跑 ArchUnit 架构测试。

## 体积约束

单文件 ≤ 400 行、单方法 ≤ 100 行、参数 ≤ 4 个、圈/认知复杂度 ≤ 20（初始 warning）。
超限时应拆分，而不是加 @SuppressWarnings。

## 质量门禁（本地，push 前）

本地开发由 AI 驱动，按阶段调用，不要等到最后：

- 实现中：只跑受影响的最小检查（spotless:apply、单测、compile）。
- 每个阶段/子任务完成：`./mvnw verify`（含 checkstyle/pmd/spotbugs/surefire/failsafe/jacoco）。
- 提交/推送前：`./mvnw -Dcrap.fail=true verify`（含 CRAP 硬门禁、依赖漏洞、依赖卫生），失败即修复后重跑，不得绕过。
- 涉及接口的改动：发 PR 前跑 `./mvnw failsafe:integration-test`。
- CRAP 目标阈值 ≤ 6（本方案采用的严格工程政策；测试补齐前以报告为准）。
- mutation 测试（PIT）不定期执行，不在门禁内。
- 不得为了让门禁通过而删测试或削弱生产代码。
```

## 11. 分阶段落地

**Phase 1（基础，一次到位）**
1. 钉 Java 8 语言级别（`maven.compiler.release=8`）+ 构建 JDK 21；加 Maven Wrapper。
2. 建立 DDD 四层目录骨架（`interfaces/application/domain/infrastructure`）。
3. 接 Spotless（google-java-format）、Checkstyle（命名/体量）、PMD（复杂度/CPD）、SpotBugs + find-sec-bugs。
4. 加 ArchUnit 架构测试（分层 + 框架隔离 + 无环）。
5. 单元/集成测试跑通 + JaCoCo 输出 XML；接 `tools/crap/Crap.java` 与 `exec-maven-plugin`（`crap.fail=false`，只出报告）。
6. 配 `lefthook`（pre-commit = spotless:apply；pre-push = `verify`）。
- **验收**：`./mvnw -Dcrap.fail=false verify` 能跑通并给出 CRAP 报告（**不含**硬门禁）；`ArchitectureTest` 通过。

**Phase 2**
启用 Error Prone（§6.6）；把 `prepush` 改为 `-Dcrap.fail=true`，让 CRAP 转为硬门禁。
- **验收**：`./mvnw verify` 通过；`./mvnw -Dcrap.fail=true verify` 会因 CRAP 超阈值而失败。

**Phase 3**
接 OWASP dependency-check + `maven-dependency-plugin:analyze-only`；把 Checkstyle/PMD 体量规则由 `warning` 升为 `error`；评估 NullAway。
- **验收**：`./mvnw -Dcrap.fail=true verify` 全绿且无新增 error。

**贯穿**：E2E（REST Assured + Testcontainers）与测试补齐可并行推进；CRAP 阈值随时间收紧到 6。

## 12. 选型与取舍（原 ADR 内容）

- **为什么「语言级别 Java 8」而「工具运行在现代 JDK」分离**：Java 生态中编译目标与工具运行 JDK 是两个概念；用现代 JDK 跑工具、`release=8` 编译，既守住 Java 8 兼容，又让现代工具可用（§2.1）。
- **为什么基线是 Java 8 + Spring Boot 2.7.18**：2.7.18 是 Java 8 的最后一条 Spring Boot 线；Spring Boot 3.x 要求 Java 17，与 Java 8 基线不兼容。
- **为什么构建工具用 Maven**：质量插件生态最成熟（Spotless/Checkstyle/PMD/SpotBugs/JaCoCo/OWASP 均有官方或一等方式），且 Java 8 项目几乎都已是 Maven。
- **为什么结构采用 DDD 四层**：把领域逻辑与 Spring/DB 解耦，`domain` 可脱离框架独立测试；分层方向与框架隔离都能落成 ArchUnit 的**可执行契约**，比纯目录约定更硬。
- **为什么架构用 ArchUnit 而非 jdeps/depan**：ArchUnit 一份即覆盖「分层 + 禁跨层 + 无环 + 切片独立性 + 框架隔离」，是 import-linter / steiger / dependency-cruiser 的综合等价物，且以 JUnit 测试形式运行、可读性强。
- **为什么格式化用 Spotless + google-java-format**：Spotless 是 Java 生态的「Prettier + lint-staged」；google-java-format 是 Google Java Style 的成文实现，风格确定、diff 稳定。
- **为什么坏味道用 PMD 而非 Sonar/SonarLint**：PMD 开源、可本地跑、规则可声明式配置，且 **PMD 7 内置 `CognitiveComplexity` 与 CPD 克隆检测**，覆盖了 Python 版工具链的缺口；无需引入重型服务。
- **为什么缺陷用 SpotBugs 而非只靠 Error Prone**：SpotBugs 基于字节码，能抓 Error Prone（源码级）抓不到的运行期缺陷；`find-sec-bugs` 复用同一插件体系做安全白盒。
- **为什么还需要 Error Prone**：Error Prone 在**编译期**提供更强的正确性/类型近似检查（对标前端的 type-aware ESLint），与 SpotBugs 互补；但 Maven 集成较琐碎，故放 Phase 2/3。
- **为什么 CRAP 用 JaCoCo 而非 PMD 算复杂度**：JaCoCo XML 已含方法级 `COMPLEXITY`，省掉 PMD↔JaCoCo 的签名匹配（重载/合成方法/Lombok 易错），风险更低、依赖更少；代价是复杂度口径不含 try/catch 分支，且需维护一个 ~150 行 Java 工具（§6.9）。
- **为什么 CRAP 工具用单文件源码启动**：免去 Maven 插件描述符与额外模块，最自包含；要求构建 JDK ≥ 11（情形 A 满足），情形 B 改用 `javac` + `java`。
- **为什么 Git 钩子用 lefthook 而非 pre-commit**：lefthook 是 Go 编译的独立二进制，跨平台（含 Windows 原生）无额外运行环境依赖；pre-commit 依赖 Python。
- **为什么安全与依赖卫生纳入门禁**：Java 后端的主要风险面之一是依赖漏洞；`dependency-check`（漏洞）+ `maven-dependency-plugin:analyze-only`（卫生）成本低、收益高。
- **为什么暂不做 CI**：本地优先；CI 是后续独立阶段。
- **为什么 CRAP 阈值 6**：采用 AI 辅助测试时代更严的**工程政策**（经典风险线为 30），把复杂度与覆盖率绑成一个可门禁指标。
- **为什么 mutation 不进门禁**：耗时且不稳定，属不定时专项任务。

## 13. 已知未覆盖 / 待办

1. **纯 JDK 8 环境下工具全面降级**：情形 B（§2.2）下 Checkstyle/SpotBugs/Error Prone/dependency-check 只能到末代，建议**升级构建 JDK**，而不是继续降级。
2. **CRAP 复杂度口径近似**：JaCoCo `COMPLEXITY` **不计 try/catch 分支**，与 PMD 口径略有差异；CRAP 数字随工具口径变化，需在团队内统一认知。
3. **CRAP 工具为自制件**：`tools/crap/Crap.java` 需随项目维护；应配套针对 `jacoco.xml` 的真实集成测试与失败路径测试（报告缺失、阈值超限）。
4. **单文件源码启动依赖 JDK ≥ 11**：情形 B（JDK 8）需改为 `javac tools/crap/Crap.java` 后 `java -cp`；本文默认情形 A。
5. **Maven 插件包装版本未逐一核实**：§4 中「未核实」项（google-java-format、archunit、dependency-check-maven、各 `*-maven-plugin` 包装版本、lefthook、exec-maven-plugin）须在目标项目现场锁定；工具库版本与插件版本是两个概念。
6. **Error Prone Maven 集成的脆弱性**：`--add-exports` 随构建 JDK 版本变化，与 Lombok 等注解处理器可能冲突；引入前先在一个分支验证（§6.6）。
7. **Checkstyle / SpotBugs / find-sec-bugs 为 LGPL 系列**：构建期工具，一般不进产物，但商用合规仍需按团队惯例确认。
8. **SOLID 的 O / L**（开闭、里氏替换）无法自动化，只能评审 + 测试。
9. **叙述性注释**（AI 味注释）无成熟确定性规则，明确留白。
10. **认知复杂度已覆盖，语义假完成桩仍不可靠**：PMD 能测认知复杂度；但「函数实际没实现」这类语义问题仍无法可靠识别。
11. **浏览器端到端未覆盖**：本文 E2E 为 HTTP 级（REST Assured + Testcontainers）；仅当前端为服务端渲染或需要真实浏览器交互时，才值得引入 Playwright-Java / Selenium。
12. **目录存在性不被强制**：ArchUnit 只约束**已存在类**的依赖关系；「四层目录始终齐全」靠评审兜底。
13. **多限界上下文未展开**：本文默认单上下文四层；多上下文时可按上下文包各建一套，并用 ArchUnit 切片规则约束跨上下文依赖。
14. **CRAP ≤ 6 极严**：需要配套补足测试，否则复杂方法会集中爆红（§8.3）。
15. **CI 门禁**：属后续独立阶段。
16. **可选增强（未写入配置，按需启用）**：`pitest`（变异测试，非门禁）、`archunit` 的更细粒度切片契约、`error-prone` 的 NullAway 全量、`javadoc` 强制、依赖版本的 `versions-maven-plugin`、可访问性/性能测试（服务端场景）。
17. **样式 / 设计 token 层不覆盖**：Java 后端无独立 CSS；若含服务端渲染样式，参照前端工具链（stylelint 等）另建。
