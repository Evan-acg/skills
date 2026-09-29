# Rust 质量工具链（Cargo Workspace 分层，CLI / 库 / 服务通用）

> 一份**可迁移**的本地质量工具链说明：把它整体搬到任意 Rust 项目即可使用。
> 推荐结构采用 **Cargo Workspace 分层**（crate 即 layer）；本文档自包含，不依赖任何特定仓库或内部工作流契约。

## 0. 一句话总结

用一套**社区最佳实践**命名的 Cargo 别名与 lefthook 钩子，把「代码质量 + 坏味道 + AI slop + workspace 分层结构 + 依赖方向 + 大文件/大函数 + 供应链与许可证 + 测试 + 覆盖率」装进本地门禁，在 `push` 之前就能拦住问题；CI 与 mutation 测试不属本门禁范畴。

## 1. 适用与边界

- **适用**：任意形态的 Rust 项目（CLI、库 crate、异步服务），**目录结构推荐 Cargo Workspace 分层**。
- **参考形态**：通用；库项目可从 `domain + shared` 起，不含 `app`。
- **包含**：`rustfmt` 格式、`clippy` 静态分析、复杂度/体积约束、workspace 分层与依赖方向、供应链与许可证、拼写与 TOML 检查、单元/集成/文档测试、覆盖率门禁、端到端（CLI/服务）测试。
- **不包含**：CI 流水线（另一阶段）、mutation testing、miri/sanitizers/fuzz/bench（属不定时专项，见 §9.4）。

## 2. Rust 基线与版本回退表

**基线：Rust stable 1.98.1（2026-09 核实），Edition 2024。** 建议在项目根加 `rust-toolchain.toml` 与 `Cargo.toml` 的 `rust-version`（MSRV）：

```toml
# rust-toolchain.toml
[toolchain]
channel = "1.98.1"
components = ["rustfmt", "clippy", "llvm-tools-preview"]
```

```toml
# Cargo.toml
[workspace.package]
edition = "2024"
rust-version = "1.85"
```

> Edition 2024 自 Rust **1.85.0（2025-02-20）** 稳定；下方回退表中的低版本列为「迁到更低环境时各工具的 major/最低要求」，**一次只降一层，并以各工具释放说明为准**。

| Rust | Edition | cargo-nextest | cargo-llvm-cov | cargo-mutants | criterion | proptest | insta |
|---|---|---|---|---|---|---|---|
| **1.98（基线）** | 2024 | 0.9.146 | 0.6.19 | 25.x | 0.7 | 1.8 | 1.43 |
| 1.91 | 2024 | 0.9.146（MSRV 1.91） | 0.6.x | 25.x | 0.7 | 1.8 | 1.43 |
| 1.85 | 2024 | 0.9.x | 0.6.x | 25.x | 0.7（MSRV 1.80） | 1.8（MSRV 1.74） | 1.43（MSRV 1.64） |
| 1.74 | 2021 | 0.9.x | 0.6.x（MSRV 1.81 需更高） | 25.x（MSRV 1.78） | — | 1.8 | 1.43 |

> 表中「—」表示该工具所需 MSRV 高于该行；`cargo-nextest` 自 0.9.146 起 MSRV 1.91，`cargo-llvm-cov` 需 1.81，`cargo-mutants` 需 1.78。**MSRV 用 `cargo-msrv` 维护**（见 §5）。

## 3. 分层总览

| 层 | 工具 | 职责 | 许可证 |
|---|---|---|---|
| 格式 | `rustfmt`（rustup 组件） | 代码格式化，官方唯一标准 | MIT OR Apache-2.0 |
| 核心 lint | `clippy`（rustup 组件） | 正确性、风格、复杂度、性能、惯用法 | MIT OR Apache-2.0 |
| TOML 格式/lint | `taplo` | `Cargo.toml` 等 TOML 格式化与校验 | MIT |
| 拼写 | `typos` | 源码与注释拼写检查 | MIT OR Apache-2.0 |
| 测试运行 | `cargo-nextest` + 内置 `cargo test --doc` | 用例并行执行；doctest 由内置 runner 补齐 | Apache-2.0 OR MIT |
| 属性测试 / 快照 / 基准 | `proptest` + `insta` + `criterion` | 属性测试、快照、微基准 | MIT / Apache-2.0 |
| 覆盖率 | `cargo-llvm-cov` | 行/区域覆盖，跨平台 | Apache-2.0 OR MIT |
| 供应链与许可证 | `cargo-deny` | 漏洞、许可证、禁用依赖、来源 | Apache-2.0 OR MIT |
| 未使用依赖 | `cargo-machete`（门禁）+ `cargo-udeps`（专项） | 未用依赖检测 | MIT |
| 结构 / 依赖方向 | 编译期 crate 边界 + `cargo-deny` `bans.wrappers` | 层序单向、跨层禁用 | 见上 |
| Git hooks | `lefthook` | pre-commit / pre-push 编排 | MIT |
| 专项（不进门禁） | `miri` / sanitizers / `cargo-fuzz` / `cargo-mutants` | UB、数据竞争、模糊测试、变异测试 | MIT OR Apache-2.0 / 见各工具 |

## 4. 依赖与许可证清单（2026-09 核实，未核实项已标注）

| 工具 | 版本 | 许可证 |
|---|---|---|
| `rustfmt` | 随 Rust 1.98.1 | MIT OR Apache-2.0 |
| `clippy` | 随 Rust 1.98.1 | MIT OR Apache-2.0 |
| `taplo`（`taplo-cli`） | 0.14.x（**库版本核实，CLI 版本待复核**） | MIT |
| `typos`（`typos-cli`） | **未核实（待复核）** | MIT OR Apache-2.0 |
| `cargo-sort` | 2.1.4 | MIT OR Apache-2.0 |
| `cargo-nextest` | 0.9.146 | Apache-2.0 OR MIT |
| `criterion` | 0.7.0 | Apache-2.0 OR MIT |
| `proptest` | 1.8.0 | MIT OR Apache-2.0 |
| `insta` | 1.43.2 | Apache-2.0 |
| `cargo-fuzz` | 0.13.1 | MIT OR Apache-2.0 |
| `cargo-llvm-cov` | 0.6.19 | Apache-2.0 OR MIT |
| `cargo-tarpaulin` | 0.34.1 | MIT OR Apache-2.0 |
| `cargo-mutants` | 25.3.1 | MIT |
| `cargo-deny` | 0.20.2 | Apache-2.0 OR MIT |
| `cargo-audit` | 0.22.2 | Apache-2.0 OR MIT |
| `cargo-udeps` | 0.1.61 | MIT OR Apache-2.0 |
| `cargo-machete` | 0.9.2 | MIT |
| `cargo-outdated` | 0.19.0 | MIT |
| `cargo-semver-checks` | 0.50.0 | Apache-2.0 OR MIT |
| `cargo-public-api` | 0.52.0 | Apache-2.0 OR MIT |
| `cargo-depgraph` | 1.6.0（**2023 起未更新**） | **GPL-3.0-or-later（许可证警示，见 §6.5、§13）** |
| `loom` | 0.7.2 | MIT |
| `lefthook` | **未核实（待复核）** | MIT |
| `cargo-husky` | 1.5.0 | MIT |
| `pre-commit` | 4.x（非 Rust 工具） | MIT |

> `rustfmt` / `clippy` / `miri` 无独立版本号，随工具链发布；以 `rust-toolchain.toml` 钉住的 channel 为准。版本信息会持续变化，使用前请复核各工具 release 页。

## 5. 安装命令

```bash
# 工具链组件（rustfmt/clippy/llvm-tools-preview 由 rust-toolchain.toml 声明，rustup 自动装）
rustup show

# 门禁所需（稳定工具）
cargo install cargo-nextest cargo-llvm-cov cargo-deny cargo-machete --locked
cargo install taplo-cli typos-cli --locked
cargo install lefthook --locked

# 可选 / 专项（按需，不进门禁）
cargo install cargo-mutants cargo-udeps cargo-fuzz cargo-sort --locked
cargo install cargo-msrv cargo-semver-checks cargo-public-api cargo-outdated --locked
cargo install cargo-husky --locked     # 若改用 cargo-husky 而非 lefthook

# nightly 专项组件（miri / sanitizers / cargo-udeps 需要）
rustup +nightly component add miri rust-src
```

## 6. 可复制配置

### 6.1 Workspace 结构（crate 即 layer）

**推荐结构（Cargo Workspace 分层）**

```text
Cargo.toml            # [workspace]：members / lints / dependencies / package
rust-toolchain.toml
rustfmt.toml
deny.toml
typos.toml
taplo.toml
lefthook.yml
.cargo/config.toml
.config/nextest.toml
crates/
  app/                # 二进制入口：解析参数、组装、调用 features，不含业务逻辑
    src/main.rs
  features/           # 业务功能，用 module 组织（auth、cart、comment…）
    src/lib.rs
    src/auth/
  domain/             # 纯领域逻辑，零 IO、零框架依赖
    src/lib.rs
  shared/             # 无业务依赖的通用工具、配置、类型
    src/lib.rs
tests/                # 跨 crate 集成测试（可选，置于各 crate 的 tests/ 亦可）
```

**根 `Cargo.toml`**

```toml
[workspace]
members = ["crates/*"]
resolver = "3"

[workspace.package]
edition = "2024"
rust-version = "1.85"
license = "MIT OR Apache-2.0"

[workspace.dependencies]
# 统一版本源，成员用 `dep.workspace = true` 引用
thiserror = "2"
serde = { version = "1", features = ["derive"] }
tracing = "0.1"
```

**层序（编译期 + 工具双重强制）**：`app → features → domain → shared`，只允许**向下**依赖；反向或跨层跳层依赖由 `cargo-deny` `bans.wrappers` 拒绝（§6.5）。库项目可省略 `app`，以 `features` 或 `domain` 为根。

> **段名说明**：`domain` 与 `shared` 是约定名；`features` 内的 feature 用 module 表达（`features/src/auth/`）。若某 feature 需要强隔离，再把它拆成独立 crate 并登记到 `wrappers` 白名单即可（见 §13）。

### 6.2 `[workspace.lints]`（clippy 集中声明）

在根 `Cargo.toml` 声明，成员 crate 只需 `[lints] workspace = true` 继承：

```toml
[workspace.lints.rust]
unsafe_code = "forbid"
# 库项目建议开启：
# missing_docs = "warn"

[workspace.lints.clippy]
# 兜底组（priority 为负，保证下方单项可覆盖）
all = { level = "deny", priority = -1 }
correctness = "deny"
suspicious = "deny"
style = "warn"
complexity = "warn"
perf = "warn"

# 体积 / 复杂度闸门（对应原文 MAX_LINES / 认知复杂度）
cognitive_complexity = "warn"   # nursery，默认阈值 25，本文档收紧到 20
too_many_lines = "warn"         # pedantic，默认 100
too_many_arguments = "warn"     # complexity，默认 7

# pedantic 择要（不全量开启，避免噪音）
module_name_repetitions = "warn"
missing_errors_doc = "warn"
missing_panics_doc = "warn"
```

成员 crate 的 `Cargo.toml`：

```toml
[lints]
workspace = true
```

> 覆盖率相关的 `cognitive_complexity` 属 `nursery`，阈值需在命令或 `clippy.toml` 中显式给出。若需自定义阈值，在 `clippy.toml` 写入 `cognitive-complexity-threshold = 20`。

**`clippy.toml`**

```toml
cognitive-complexity-threshold = 20
too-many-lines-threshold = 100
too-many-arguments-threshold = 7
```

### 6.3 `rustfmt.toml`

```toml
edition = "2024"
max_width = 100
tab_spaces = 4
use_field_init_shorthand = true
newline_style = "Auto"
```

### 6.4 `taplo.toml` 与 `typos.toml`

```toml
# taplo.toml
include = ["**/*.toml"]
exclude = ["target/**"]

[formatting]
align_entries = false
reorder_keys = false
```

```toml
# typos.toml
[files]
extend-exclude = ["target", "Cargo.lock", "*.snap"]

[default]
extend-ignore-identifiers-re = ["(?i)serde?_.*"]
```

### 6.5 `deny.toml`（供应链 + 层序强制）

> 层序的两道锁：**编译期 crate 边界**（跨层反向依赖直接编译失败）+ **`cargo-deny` `bans.wrappers`**（显式声明「谁可以依赖谁」）。`wrappers` 语义：只允许列表中的 crate 依赖被 `deny` 的 crate。

```toml
# deny.toml
[advisories]
version = 2
yanked = "deny"
ignore = []          # 每条 ignore 必须写明理由与到期时间

[licenses]
version = 2
allow = [
  "MIT",
  "Apache-2.0",
  "Apache-2.0 WITH LLVM-exception",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Unicode-3.0",
  "Zlib",
]
# GPL / LGPL / AGPL 不在白名单 → 默认拒绝，须人工评审后显式放行

[bans]
multiple-versions = "warn"
wildcards = "deny"
# 层序强制：domain 只允许被 app / features 依赖；shared 只允许被上层及 domain 依赖
deny = [
  { name = "myproject-domain", wrappers = ["myproject-app", "myproject-features"] },
  { name = "myproject-shared", wrappers = ["myproject-app", "myproject-features", "myproject-domain"] },
]

[sources]
unknown-registry = "deny"
unknown-git = "deny"
```

> **许可证警示**：`cargo-depgraph` 为 **GPL-3.0-or-later**，默认被上表白名单拒绝；若确需使用，须人工评审并记录理由。这与原文对 `eslint-plugin-sonarjs`（LGPL-3.0-only）的标注体例一致。

### 6.6 `.cargo/config.toml`（原子命令别名，替代 npm scripts）

```toml
# .cargo/config.toml
[alias]
fmt-check  = "fmt --all --check"
lint       = "clippy --all-targets --all-features -- -D warnings"
test-all   = "nextest run --all-features"
test-doc   = "test --doc --all-features"
cov        = "llvm-cov --all-features --lcov --output-path lcov.info"
cov-gate   = "llvm-cov --all-features --fail-under-lines 60"
deny-check = "deny check"
machete    = "machete ."
```

> Cargo 别名无法串联多步命令；多步序列由 `lefthook` 编排（§6.7），别名只承载**原子**命令。

### 6.7 `lefthook.yml`（pre-commit 快反馈 + pre-push 全门禁）

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    fmt:
      glob: "*.rs"
      run: cargo fmt --all
      stage_fixed: true
    clippy:
      glob: "*.rs"
      run: cargo clippy --all-targets --all-features -- -D warnings
    typos:
      run: typos

pre-push:
  commands:
    fmt-check: { run: cargo fmt --all --check }
    lint:      { run: cargo clippy --all-targets --all-features -- -D warnings }
    taplo:     { run: taplo fmt --check }
    typos:     { run: typos }
    test:      { run: cargo nextest run --all-features }
    doctest:   { run: cargo test --doc --all-features }
    coverage:  { run: cargo llvm-cov --all-features --fail-under-lines 60 }
    deny:      { run: cargo deny check }
    machete:   { run: cargo machete . }
```

安装钩子：`lefthook install`（等价于 `prepare` 步骤，可在文档/README 声明）。

> **关键点（覆盖率渐进，避免自相矛盾）**：Phase 1 的 `coverage` 一行先用 `cargo llvm-cov --all-features --lcov`（只出报告，**不**带 `--fail-under-lines`）。待测试补齐后，改成 `--fail-under-lines 60`（Phase 2）→ `80`（Phase 3）——**只改这一行**，覆盖率即从「报告」升级为「硬门禁」。Phase 1 不要直接设阈值，否则新项目会因存量未覆盖直接失败。

### 6.8 `.config/nextest.toml`

```toml
[profile.default]
fail-fast = false

[profile.ci]
retries = 2
slow-timeout = { period = "60s", terminate-after = 2 }
```

### 6.9 集成 / 端到端测试骨架

- **CLI 端到端**：`assert_cmd` 断言子进程退出码/输出，`insta` 做黄金输出。
- **服务端到端**：`testcontainers` 起真实依赖（DB/队列），或对真实进程发请求。
- **UI（Tauri / Web 前端）**：沿用原文思路用 Playwright（本工具链不展开）。

```rust
// crates/app/tests/cli.rs
use assert_cmd::Command;
use predicates::prelude::*;

#[test]
fn prints_help() {
    Command::cargo_bin("myproject-app")
        .unwrap()
        .arg("--help")
        .assert()
        .success()
        .stdout(predicate::str::contains("Usage:"));
}
```

```rust
// 快照（insta）：领域逻辑的确定性输出
#[test]
fn renders_report() {
    let out = render_report(&fixture());
    insta::assert_snapshot!(out);
}
```

### 6.10 忽略文件

`.gitignore`

```text
/target
lcov.info
coverage/
```

`.ignore` / typos 排除已在 §6.4 声明；`taplo` 排除已在 §6.4 声明。`Cargo.lock` 对二进制项目应入库，对库项目可选。

## 7. 规则 → 症状 / 目标映射表

| 目标 | 落实方式 | 状态 |
|---|---|---|
| 幻影导入（AI 生成不存在模块） | 编译期直接报错（Rust 无「未解析导入」运行期概念） | **内置** |
| 被吞异常 / 空错误处理 | `clippy::let_underscore_must_use`、`unused_must_use`、`clippy::question_mark` | **已配置** |
| 假完成桩 / 空实现 | `clippy::todo`、`unimplemented`（deny）；`missing_docs` | **已配置** |
| 大函数 | `clippy::too_many_lines`（warn, 100） | **已配置**（§6.2） |
| 认知复杂度 | `clippy::cognitive_complexity`（warn, 20） | **已配置**（§6.2） |
| 参数过多 | `clippy::too_many_arguments`（warn, 7） | **已配置**（§6.2） |
| 重复 / 复制粘贴 | clippy 无直接对应；`clippy::same_item_push` 等局部规则 | **部分覆盖**（§13） |
| 层序 / 跨层依赖 | 编译期 crate 边界 + `cargo-deny` `bans.wrappers` | **已配置**（§6.5） |
| 循环依赖 | Cargo 不允许循环 crate 依赖（编译期）；模块内循环由编译器部分拦截 | **内置** |
| 未使用依赖 | `cargo-machete`（门禁）+ `cargo-udeps`（专项，nightly） | **已配置**（§6.7） |
| 供应链漏洞 / 许可证 | `cargo-deny` `advisories` + `licenses` + `sources` | **已配置**（§6.5） |
| 拼写 / 注释错别字 | `typos` | **已配置**（§6.7） |
| TOML 格式 / 键序 | `taplo` | **已配置**（§6.7） |
| 测试 / 覆盖率 | `cargo-nextest` + `cargo-llvm-cov` | **已配置**（§6.7、§8） |
| 叙述性注释（AI 味注释） | —— | **未覆盖**（§13） |

### SOLID 逐条覆盖（诚实说明：SOLID 是设计原则，无工具能直接检查）

| 原则 | 近似手段 |
|---|---|
| S 单一职责 | `clippy::cognitive_complexity` / `too_many_lines` / `too_many_arguments`；workspace 分层与 crate 边界 |
| O 开闭 | **无自动规则**（评审 + 测试） |
| L 里氏替换 | **无自动规则**（评审 + 测试） |
| I 接口隔离 | `pub` / `pub(crate)` 可见性收紧；`cargo-public-api` 审计公开面 |
| D 依赖倒置 | 层序单向（§6.5）、crate 边界、`domain` 零 IO |

## 8. 测试与覆盖率门禁

### 8.1 分层

- **单元**：纯逻辑，`#[cfg(test)] mod tests` 内联，`cargo-nextest` 运行。
- **属性测试**：`proptest` 覆盖不变量与边界。
- **快照**：`insta` 固化结构化输出（`*.snap` 入库，评审 diff）。
- **文档测试**：`cargo test --doc`（nextest 不执行 doctest，必须单独跑）。
- **集成 / 端到端**：`assert_cmd` + `testcontainers`（§6.9）。
- **基准**：`criterion`，不进门禁，按需运行。

### 8.2 覆盖率门禁（CRAP 的 Rust 替代）

- **原文的 CRAP**：`复杂度² × (1 − 覆盖率)³ + 复杂度`。Rust 生态**无现成 CRAP 工具**，本工具链用两个可门禁指标近似：
  - **复杂度**：`clippy::cognitive_complexity`（阈值 20）；
  - **覆盖率**：`cargo-llvm-cov --fail-under-lines <阈值>`。
- **输入**：`cargo llvm-cov ... --lcov` 生成的 `lcov.info`（或 HTML）。
- **阈值**：Phase 1 不设；Phase 2 `60`；Phase 3 `80`（见 §8.3、§11）。

### 8.3 渐进策略

1. clippy 体积/复杂度三条先 `warn`；覆盖率先**只出报告**；
2. 补测试 → 覆盖率设阈值 `60` 转硬门禁；
3. 继续补测试 → 收紧到 `80`；
4. 存量收敛后，把 `cognitive_complexity` / `too_many_lines` / `too_many_arguments` 由 `warn` 升为 `deny`，clippy 全量 `-D warnings`。

## 9. 本地门禁流程（无 CI）

### 9.1 `pre-commit`（快速反馈）
`lefthook`：对暂存 `*.rs` 跑 `cargo fmt` + `clippy`，并跑 `typos`。

### 9.2 `push` 之前（强门禁）
`lefthook` `pre-push`：`fmt --check` + `clippy -D warnings` + `taplo` + `typos` + `nextest` + `test --doc` + `llvm-cov`（阈值）+ `cargo deny check` + `cargo machete`。失败即中止，符合「问题在 push 前本地处理」。

### 9.3 集成 / 端到端（不进门禁）
`assert_cmd` / `testcontainers` 测试单独运行，在发 PR 前手动执行；UI 项目另跑 Playwright。

### 9.4 专项（不定时，非门禁）
`miri`（UB）、sanitizers（`-Z sanitizer=address|thread|undefined`）、`cargo-fuzz`、`cargo-mutants`、`criterion` bench 均为**耗时或需 nightly**，不属本门禁，按需不定期执行。本文档不展开。

## 10. 接入 AI 工作流

本地开发已由 AI 驱动，因此把上述命令按「任务阶段」绑定：AI 每完成一个阶段就调用对应命令，而不是等到最后。

### 10.1 阶段 → 命令

| 阶段 | 动作 | 命令 |
|---|---|---|
| 探索 / 设计 | 只读、不改码 | 不跑门禁 |
| 实现中（改动未稳定） | 只跑**受影响**的最小检查 | `cargo clippy -p <crate> -- -D warnings`、`cargo nextest run -p <crate>` |
| 一个阶段/子任务完成 | 全量静态 + 测试 | `cargo fmt --all --check && cargo lint && cargo test-all` |
| 收尾（提交前） | 完整本地门禁 | `lefthook run pre-push` |
| 涉及 CLI / 服务交互 | 端到端 | `cargo test --test cli` 等（登录态类项目另跑 E2E） |
| 依赖改动 | 供应链 | `cargo deny check && cargo machete .` |
| 新增 / 移动 crate 或层 | 结构 | `cargo deny check`（验证层序 `wrappers`）+ `cargo metadata` 复核 |
| 库 API 变更（发布前） | 语义化版本 | `cargo semver-checks check-release` |
| 不定时 | mutation / miri / fuzz / bench | 按需，非门禁 |

### 10.2 可复制到 `AGENTS.md` 的片段

```md
## 项目结构：Cargo Workspace 分层

层只能向下依赖：app → features → domain → shared；
禁止反向依赖与跨层跳层；domain 零 IO、不依赖任何框架。
新增/移动 crate 或层后，必须跑 `cargo deny check` 与 `cargo metadata` 复核。

## 体积与复杂度约束

单函数 ≤ 100 行、认知复杂度 ≤ 20、参数 ≤ 7（初始 warn）。
超限时应拆分，而不是加 `#[allow(...)]`。

## 质量门禁（本地，push 前）

本地开发由 AI 驱动，按阶段调用，不要等到最后：

- 实现中：只跑受影响的最小检查（`cargo clippy -p <crate>`、`cargo nextest run -p <crate>`）。
- 每个阶段/子任务完成：`cargo fmt --all --check && cargo lint && cargo test-all`。
- 提交/推送前：`lefthook run pre-push`（含覆盖率、cargo-deny、machete），失败即修复后重跑，不得绕过。
- 涉及 CLI/服务的改动：发 PR 前跑端到端测试。
- 覆盖率目标：Phase 2 起 60，Phase 3 收紧到 80。
- mutation / miri / sanitizers / fuzz / bench 不定期执行，不在门禁内。
- 不得为了让门禁通过而删测试或削弱生产代码。
```

## 11. 分阶段落地

**Phase 1（基础，一次到位）**
1. 钉工具链：`rust-toolchain.toml`（channel 1.98.1 + 组件）+ `Cargo.toml` `rust-version`。
2. 建立 workspace 骨架（`crates/{app,features,domain,shared}` + `resolver = "3"`）。
3. 落 `[workspace.lints]` + `clippy.toml`（复杂度/体积三条先 `warn`）。
4. 落 `rustfmt.toml` / `taplo.toml` / `typos.toml`。
5. 落 `deny.toml`（四段全开 + 许可证白名单 + `bans.wrappers` 层序）。
6. 落 `.cargo/config.toml` 别名与 `lefthook.yml`；`pre-push` 覆盖率一行**只出报告**。
7. 补 `.config/nextest.toml`，跑通单元/集成/doctest。
- **验收**：`lefthook run pre-push` 能跑通并给出覆盖率报告（**不含**阈值）；`cargo deny check` 通过（层序 `wrappers` 生效）。

**Phase 2**
把 `pre-push` 覆盖率一行改为 `--fail-under-lines 60`（硬门禁）；补测试使门禁通过。
- **验收**：覆盖率低于 60 时 `pre-push` 失败。

**Phase 3**
覆盖率收紧到 `80`；把 `cognitive_complexity` / `too_many_lines` / `too_many_arguments` 由 `warn` 升为 `deny`；`clippy -D warnings` 全量。
- **验收**：`cargo lint` 无新增 warning。

**贯穿**：端到端测试、`typos` 词表、`cargo-machete` 清理可并行推进；覆盖率阈值随时间收紧。

## 12. 选型与取舍（原 ADR 内容）

- **为什么结构采用 Workspace 分层**：把「层」变成**编译期**可强制的 crate 边界；层序单向、跨层引用直接编译失败或由 `cargo-deny` 拦下，天然抑制循环依赖与上帝模块。这是 FSD 在 Rust 中最贴近的等价物。
- **为什么每层一个 crate、feature 用 module**：crate 边界给出强隔离，但 crate 数过多会拖慢编译、抬高维护成本；FSD 式「每 feature 一 crate」在 Rust 中常导致 crate 爆炸。热点 feature 可按需升级为独立 crate 并登记 `wrappers`。
- **为什么层序用 `cargo-deny` `bans.wrappers`**：与供应链检查同工具、同配置文件，声明式、零自定义代码，无需 dylint 那样写 Rust lint 并承担 nightly 依赖。
- **为什么用 `rustfmt` + `clippy` 而非第三方**：两者是官方组件、随工具链发布，零新增依赖、零版本漂移，且 `[lints]` 表能集中声明、workspace 一处生效。
- **为什么用 `cargo-nextest` 且必须补 doctest**：并行执行、重试、清晰输出有利门禁；但 nextest **不跑 doctest**，故 `cargo test --doc` 不可省。
- **为什么覆盖率用 `cargo-llvm-cov`**：跨平台（含 Windows）、基于 LLVM 源码级分区，优于 Linux 偏向的 `tarpaulin`。
- **为什么用 `cargo-machete` 作门禁、`cargo-udeps` 归专项**：两者功能重叠，machete 快且稳定，udeps 需 nightly、更重，留给专项。
- **为什么 CRAP 换成「复杂度 + 覆盖率」**：Rust 无成熟 CRAP 工具；用 clippy 认知复杂度 + 覆盖率两个可门禁指标近似，避免自建脚本。
- **为什么 mutation / miri / sanitizers / fuzz 不进门禁**：耗时或依赖 nightly，不稳定，属不定时专项。
- **为什么用 `lefthook`**：跨平台、YAML 声明、可并行、可 `stage_fixed`，比 `cargo-husky`（hook 内容藏在 Cargo 依赖、易被覆盖）更透明。
- **为什么用 Cargo 别名而非 `just` / `xtask`**：别名是 Cargo 自带，零新工具；原子命令交给别名、多步序列交给 lefthook，避免为一个编排引入额外构建工具。
- **为什么暂不做 CI**：本地优先；CI 是后续独立阶段。

## 13. 已知未覆盖 / 待办

1. **叙述性注释**（AI 味注释）无成熟确定性规则，明确留白。
2. **SOLID 的 O / L**（开闭、里氏替换）无法自动化，只能评审 + 测试。
3. **CRAP 无 Rust 对应工具**：以「复杂度 + 覆盖率」近似，非等价替代。
4. **同层 feature 隔离较弱**：层内 feature 为 module，编译期不阻止 module 间互相 import；强隔离需拆 crate 并登记 `wrappers`（§6.1、§12）。
5. **重复代码检测弱**：Rust 无 `sonarjs/no-identical-functions` 等价物，仅靠 clippy 局部规则 + 评审。
6. **`cargo-deny` `wrappers` 语法需以官方文档为准**：本文档示例为示意，落地前用 `cargo deny check` 实测。
7. **许可证**：`cargo-depgraph` 为 GPL-3.0-or-later（默认被拒）；其余依赖须以 `cargo-deny licenses` 实际输出为准。部分工具版本/许可证列「未核实」，使用前复核。
8. **需 nightly 的项**：`miri`、sanitizers、`cargo-udeps`、`cargo-fuzz`、`cargo-public-api` 对 nightly 的要求随版本变化。
9. **阈值需按项目实测调**：认知复杂度 20 / 行数 100 / 参数 7、覆盖率 60→80 均为初始建议；老项目存量超标时先 `warn`，收敛后再升 `deny`（§8.3）。
10. **覆盖率阈值不等于 CRAP ≤ 6**：无法迁移原文的严格度，须自行权衡。
11. **可选增强（未写入配置，按需启用）**：`cargo-semver-checks`（库发布门禁）、`cargo-public-api`、`cargo-outdated`、`loom`（并发模型）、`proptest`/`insta`/`criterion` 纳入 CI、`commitlint`（Rust 侧对应 commit 规范校验）。
12. **CI 门禁**：属后续独立阶段。
