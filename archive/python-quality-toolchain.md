# Python 质量工具链（Flask + Ruff + mypy + pytest + uv）

> 一份**可迁移**的本地质量工具链说明：把它整体搬到任意 Flask Web 应用/服务即可使用。
> 本文档自包含，不依赖任何特定仓库或内部工作流契约。示例包名统一用 `app`（源码位于 `src/app/`）。

## 0. 一句话总结

用一套**社区最佳实践**命名的任务（`poe`），把「代码质量 + 坏味道 + AI slop 近似 + 架构/依赖边界 + 类型 + 测试 + CRAP + 安全与依赖卫生」装进本地门禁，在 `push` 之前就能拦住问题；CI 与 mutation 测试不属本门禁范畴。

## 1. 适用与边界

- **适用**：以 uv 管理依赖、Python 3.13 为基线的 **Flask Web 应用/服务**（`src/` 布局）。
- **参考案例**：`app`（`src/app/`，DDD 四层 + `create_app()` 组合根）；仅作对照，不在本次改动范围内。
- **包含**：静态 lint 与格式化、坏味道、AI slop 近似、架构/依赖边界、类型检查、单元/集成测试、Flask 端到端测试、CRAP 门禁、安全扫描、依赖卫生、Git 钩子。
- **不包含**：CI 流水线（另一阶段）、mutation testing（属不定时任务，见 §9.4）。样式/设计 token 层：仅在服务端渲染含独立 CSS 时才需要，本文不展开（见 §13）。

## 2. 项目基线与目录结构约束

### 2.1 Python 基线与版本回退

**基线：Python 3.13。** 用 uv 钉住解释器与依赖：

```bash
uv python pin 3.13
```

`pyproject.toml` 声明：

```toml
[project]
name = "app"
requires-python = ">=3.13"

[tool.uv]
package = true
```

> **关于精确版本**：本文档不锁定各包的 patch 版本。原因：本次编写环境无法可靠读取 PyPI 的动态版本字段，硬写版本号会变成不可核实的猜测。正确做法是在目标项目执行 `uv add` / `uv lock`，由 uv 解析并写入 `uv.lock` 与 `pyproject.toml`，以各包 `requires-python` 与解析结果为准。

若迁移到更低 Python 环境，按此表回退，**一次只降一个层级**：

| Python | 定位 | 说明 |
|---|---|---|
| **3.13** | 基线 | 当前主流工具均支持 |
| 3.12 | 回退 1 级 | 主流工具均支持，兼容性最稳 |
| 3.11 | 回退 2 级 | 仍受支持，但部分工具下一 major 可能要求 ≥ 3.12；锁定时以各包 `requires-python` 为准 |

> 补充：Flask 3.x 要求 Python ≥ 3.9，上述基线均满足。若未来评估引入 `ty`（Astral 类型检查器），注意它目标支持 Python 3.10+，但仍是 `0.0.x` beta，API 与诊断不稳定（见 §12、§13）。

### 2.2 目录结构约束（DDD 四层）

**规范目录树**（Flask + uv `src/` 布局；示例包名 `app`）：

```text
<repo>/
├── pyproject.toml            # 唯一配置源：ruff / mypy / pytest / import-linter / poe
├── uv.lock
├── .python-version
├── .pre-commit-config.yaml
├── src/
│   └── app/                  # 唯一业务代码根
│       ├── __init__.py       # 仅 create_app()：装配 extensions 与蓝图（组合根）
│       ├── config.py
│       ├── extensions.py     # 扩展实例集中定义
│       ├── interfaces/       # 接口层：http/(Blueprint)、CLI、消息入口
│       ├── application/      # 应用层：commands/、queries/（用例编排）
│       ├── domain/           # 领域层：model/、events.py、ports.py（纯抽象）
│       └── infrastructure/   # 基础设施层：persistence/、gateways/（实现 domain.ports）
├── scripts/                  # 工程脚本（crap.py 等），非运行期代码
│   └── crap.py
└── tests/
    ├── conftest.py
    ├── unit/
    ├── integration/
    └── e2e/
```

**依赖方向（DDD / 端口-适配器）**

```text
interfaces ──▶ application ──▶ domain ◀── infrastructure
```

- `interfaces → application → domain` 单向；反向禁止。
- `infrastructure → domain`：实现领域定义的端口（仓储/网关接口）。
- `domain` 不依赖任何其他层，也不依赖 Flask / 数据库 / 网络。

**约束条目**

1. **业务根唯一**：所有运行期代码在 `src/app/`；禁止在仓库根或 `src/` 直接放 Python 模块（防 import 歧义，保 deptry / mypy 边界清晰）。
2. **分层方向**：见上；`interfaces` / `application` / `domain` 不得导入 `infrastructure`（依赖倒置：内层不知道外层适配器）。
3. **组合根唯一**：`app/__init__.py` 只放 `create_app()`，负责装配 extensions 与蓝图；不放业务逻辑。
4. **领域纯净**：`domain` 与 `application` 不得导入 `flask` / `werkzeug`；请求上下文只出现在 `interfaces` 层。
5. **测试镜像分层**：`tests/unit` 纯函数、`tests/integration` 用 `test_client`、`tests/e2e` 真实 HTTP。
6. **工程脚本隔离**：`scripts/` 不进运行期包，ruff 对其放宽 `T20`（§6.1），且不在覆盖率 `source` 内。
7. **生成物不手改 / 不 lint / 不入覆盖率**：`.venv/`、`build/`、`dist/`、`.mypy_cache/`、`.pytest_cache/`、`.ruff_cache/`、`coverage/`、`coverage.json`、`requirements-runtime.txt`。

**约束 → 落实位置**

| 约束 | 落实位置 |
|---|---|
| 业务根唯一 | ruff `src = ["src", "tests"]`、`extend-exclude`；mypy `files = ["src", "tests"]`（§6.1、§6.2） |
| 分层方向 + DIP | import-linter `layers` / `forbidden` 契约（§6.3） |
| 领域/应用层不绑框架 | import-linter `forbidden`（顶层开 `include_external_packages`，禁 `flask` / `werkzeug`）（§6.3） |
| 测试分层 | pytest `testpaths = ["tests"]`；coverage `source = ["app"]`（§6.4） |
| 脚本不打包 | 仅 `src/app` 打包；`scripts/` 不在 `src`（§5） |
| 生成物 | `.gitignore` + 各工具 exclude（§6.10） |

> 目录的"存在性"本身不被工具强制（空目录不会报错）；契约只约束**已存在模块**之间的导入关系。多限界上下文时，可用 import-linter 的 `containers` + `exhaustive` 为每个上下文各建一套四层（本文默认单上下文，见 §13）。

## 3. 分层总览

| 层 | 工具 | 职责 | 许可证 |
|---|---|---|---|
| 核心 lint + 格式 | `ruff`（`ruff check` + `ruff format`） | 规则检查 + 格式化一体化 | MIT |
| 类型检查 | `mypy` | 静态类型检查（strict 渐进） | MIT |
| 坏味道 / 复杂度 / 体量 | `ruff`（`C90` / `PLR09xx` / `SIM` / `RET` / `PIE`）+ `radon` + `xenon` + 自制 metrics | 圈复杂度、语句/分支/返回/参数上限、文件与类体量、可简化代码（**不检测认知复杂度与代码克隆**） | MIT |
| 依赖与幻影导入 | `ruff`（`I` 排序）+ `mypy`（import-not-found）+ `deptry` | 未声明/未使用依赖、未解析导入 | MIT |
| 架构 / 依赖边界 | `import-linter` | 分层、禁跨层、独立性契约 | BSD-2-Clause |
| 测试 | `pytest` + `pytest-cov` + `coverage` | 单元/集成测试、覆盖率 | MIT / Apache-2.0 |
| Flask 集成 | `pytest` + Flask `test_client` | 进程内路由/视图行为 | MIT / BSD-3-Clause |
| Flask 端到端 | Werkzeug `make_server` 测试服务器 + `httpx` | 真实 HTTP、跨网络栈 | MIT / BSD-3-Clause |
| CRAP | `radon` + `coverage`（自算脚本） | 复杂度 × 覆盖率门禁 | MIT / Apache-2.0 |
| 安全与依赖卫生 | `bandit` + `pip-audit` + `deptry` | 安全白盒、依赖漏洞、依赖卫生 | Apache-2.0 / MIT |
| Git 钩子 | `pre-commit` | pre-commit 快修 + pre-push 强门禁 | MIT |
| 任务载体 | `poethepoet` | 以 `poe` 命名任务（对标 npm scripts） | MIT |

> 运行期框架 `flask` 本身不是质量工具，未列入本表，仅作为被测对象。

## 4. 依赖与许可证清单

实测环境无法读取 PyPI 动态版本，故本表**不给 patch 版本号**，只给许可证（按官方仓库声明整理）与安装来源。

| 包 | 许可证 | 来源 |
|---|---|---|
| `flask` | BSD-3-Clause | [PyPI](https://pypi.org/project/Flask/) · [GitHub](https://github.com/pallets/flask) |
| `werkzeug` | BSD-3-Clause | [PyPI](https://pypi.org/project/Werkzeug/) · [GitHub](https://github.com/pallets/werkzeug) |
| `ruff` | MIT | [PyPI](https://pypi.org/project/ruff/) · [GitHub](https://github.com/astral-sh/ruff) |
| `mypy` | MIT | [PyPI](https://pypi.org/project/mypy/) · [GitHub](https://github.com/python/mypy) |
| `pytest` | MIT | [PyPI](https://pypi.org/project/pytest/) · [GitHub](https://github.com/pytest-dev/pytest) |
| `pytest-cov` | MIT | [PyPI](https://pypi.org/project/pytest-cov/) · [GitHub](https://github.com/pytest-dev/pytest-cov) |
| `coverage` | Apache-2.0 | [PyPI](https://pypi.org/project/coverage/) · [GitHub](https://github.com/nedbat/coveragepy) |
| `radon` | MIT | [PyPI](https://pypi.org/project/radon/) · [GitHub](https://github.com/rubik/radon) |
| `xenon` | MIT | [PyPI](https://pypi.org/project/xenon/) · [GitHub](https://github.com/rubik/xenon) |
| `import-linter` | BSD-2-Clause | [PyPI](https://pypi.org/project/import-linter/) · [GitHub](https://github.com/seddonym/import-linter) |
| `httpx` | BSD-3-Clause | [PyPI](https://pypi.org/project/httpx/) · [GitHub](https://github.com/encode/httpx) |
| `pre-commit` | MIT | [PyPI](https://pypi.org/project/pre-commit/) · [GitHub](https://github.com/pre-commit/pre-commit) |
| `poethepoet` | MIT | [PyPI](https://pypi.org/project/poethepoet/) · [GitHub](https://github.com/nat-n/poethepoet) |
| `bandit` | Apache-2.0 | [PyPI](https://pypi.org/project/bandit/) · [GitHub](https://github.com/PyCQA/bandit) |
| `pip-audit` | Apache-2.0 | [PyPI](https://pypi.org/project/pip-audit/) · [GitHub](https://github.com/pypa/pip-audit) |
| `deptry` | MIT | [PyPI](https://pypi.org/project/deptry/) · [GitHub](https://github.com/fpgmaas/deptry) |
| `uv` | Apache-2.0 / MIT | [PyPI](https://pypi.org/project/uv/) · [GitHub](https://github.com/astral-sh/uv) |

> 备选（本文档默认不启用，见 §12/§13）：
>
> | 包 | 许可证 | 备注 |
> |---|---|---|
> | `pylint` | **GPL-2.0-or-later** | 规则成熟，但重型且许可证为 copyleft，商用需自行确认合规 |
> | `pyright` | MIT | npm 分发的类型检查器，可作 mypy 替代 |
> | `ty` | MIT | Astral 类型检查器，比 mypy/Pyright 快 10–100 倍，但仍是 `0.0.x` beta |
> | `playwright` | Apache-2.0 | 仅当服务端渲染有真实浏览器交互需求时才引入（见 §6.5） |
> | `mutmut` | BSD-3-Clause | 变异测试，非门禁 |

## 5. 安装命令

```bash
# 项目骨架：应用模板，源码位于 src/<包名>/（本文示例 src/app/）
# 已有目录内初始化用 --name 显式指定包名；若需新建目录则 `uv init app && cd app`
uv init --name app
uv python pin 3.13

# 运行期框架
uv add flask

# 核心 lint + 格式化 + 类型检查
uv add --dev ruff mypy

# 测试 + 覆盖率 + 端到端 HTTP
uv add --dev pytest pytest-cov coverage httpx

# 复杂度 + 架构 + 依赖卫生 + 安全
uv add --dev radon xenon import-linter deptry bandit pip-audit

# Git 钩子 + 任务载体
uv add --dev pre-commit poethepoet
```

> `uv init` 的应用模板产出 `src/<包名>/` 布局；**包名默认取当前目录名**，用 `--name` 显式指定才能保证是 `app`。本文示例包名为 `app`，因此所有**文件系统路径**都是 `src/app`。迁移到实际项目时，把全篇的 `app` / `src/app` 全局替换为真实包名。任务统一用 `uv run poe <task>` 执行，不依赖全局安装。

## 6. 可复制配置

### 6.1 `pyproject.toml` 的 `[tool.ruff]`（lint + format 一体化）

```toml
[tool.ruff]
line-length = 120
target-version = "py313"
src = ["src", "tests"]
extend-exclude = ["build", "dist", ".venv"]

[tool.ruff.lint]
select = [
  "E", "W",     # pycodestyle
  "F",          # pyflakes（未用导入/未定义名）
  "I",          # isort（导入排序）
  "B",          # flake8-bugbear
  "C90",        # mccabe 圈复杂度
  "SIM",        # flake8-simplify
  "PL",         # pylint 移植规则
  "RUF",        # ruff 自有规则
  "S",          # flake8-bandit（安全近似，见 §7）
  "T20",        # flake8-print（调试 print / AI 味近似）
  "ERA",        # 注释掉的死代码
  "PTH",        # flake8-use-pathlib
  "RET",        # flake8-return
  "PIE",        # flake8-pie
  "ARG",        # 未使用参数
  "TID",        # 导入纪律
  "ANN",        # 类型注解完整度
]
ignore = [
  # 行宽采用 formatter 的 best-effort 策略（不是硬保证），
  # 因此不把超过 120 字符作为硬错误。
  "E501",
]

[tool.ruff.lint.mccabe]
max-complexity = 20

[tool.ruff.lint.pylint]
max-args = 8
max-statements = 50
max-branches = 12
max-returns = 6

[tool.ruff.lint.isort]
known-first-party = ["app"]

[tool.ruff.lint.per-file-ignores]
# 测试放宽：允许 assert、魔法值、缺注解
"tests/**" = ["S101", "PLR2004", "ANN"]
# 自算 CRAP 脚本属工具代码，允许打印
"scripts/**" = ["T20"]

[tool.ruff.format]
quote-style = "double"
indent-style = "space"
line-ending = "auto"
```

> **关键点 1**：Ruff 同时承担原前端方案里 `eslint` + `eslint-plugin-import-x` + `prettier` 的职责；`C90`/`PLR` 承担 `sonarjs` 的复杂度与坏味道职责。`S`（flake8-bandit 子集）与独立 `bandit` 的关系见 §12。
>
> **关键点 2（函数/方法级上限）**：稳定规则可用 `C901`（圈复杂度 ≤20）、`PLR0915`（语句数 ≤50）、`PLR0913`（参数数 ≤8）、`PLR0912`（分支数 ≤12）、`PLR0911`（返回数 ≤6）。`PLR0914`（局部变量）、`PLR0916`（布尔表达式）、`PLR0917`、`PLR1702`（嵌套块）、`PLR0904`（公共方法数）**均为 preview**；本方案**不启用全局 `preview`**（会一次性激活所有 preview 规则、不稳定），所以**上帝类与体量改由自制件覆盖**（§6.6）。`PLR0902`（实例属性数）Ruff **未实现**。

### 6.2 `pyproject.toml` 的 `[tool.mypy]`（strict 渐进）

```toml
[tool.mypy]
python_version = "3.13"
strict = true
files = ["src", "tests"]
exclude = ["build/", "dist/"]
pretty = true
show_error_codes = true

[[tool.mypy.overrides]]
# 测试可放宽：不强制每个测试函数写注解
module = ["tests.*"]
disallow_untyped_defs = false
```

> **渐进**：Phase 1 可先去掉 `strict = true`（或只对 `src` 开 strict），Phase 2 再全量开启（见 §11）。

### 6.3 `pyproject.toml` 的 `[tool.importlinter]`（架构 / 依赖边界，对标 dependency-cruiser）

```toml
[tool.importlinter]
root_package = "app"
# 允许在 forbidden 契约中引用外部包（如 flask）
include_external_packages = true

[[tool.importlinter.contracts]]
name = "DDD 分层：interfaces → application → domain，反向禁止"
type = "layers"
layers = ["app.interfaces", "app.application", "app.domain"]

[[tool.importlinter.contracts]]
name = "依赖倒置：内层不得导入 infrastructure"
type = "forbidden"
source_modules = ["app.interfaces", "app.application", "app.domain"]
forbidden_modules = ["app.infrastructure"]

[[tool.importlinter.contracts]]
name = "领域/应用层不得依赖 Web 框架"
type = "forbidden"
source_modules = ["app.domain", "app.application"]
forbidden_modules = ["flask", "werkzeug"]
```

> `import-linter` 官方支持三类契约：`layers`、`forbidden`、`independence`。禁外部包需在顶层开 `include_external_packages = true`，且外部模块**只能写到顶层包名**（如 `flask`，不能写 `flask.request`）。目录与分层定义见 §2.2。它能检查模块依赖方向与边界，**不等于**完整 SOLID 检查（见 §7）。

### 6.4 `pyproject.toml` 的 `[tool.pytest.ini_options]` + 覆盖率

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra --strict-markers"
markers = [
  "e2e: 真实 HTTP 的端到端测试（默认不跑）",
]

[tool.coverage.run]
branch = true
source = ["app"]

[tool.coverage.report]
show_missing = true
```

覆盖率输出 LCOV 与 JSON（供 CRAP 用）：

```bash
uv run pytest --cov=app \
  --cov-report=term-missing \
  --cov-report=lcov:coverage/lcov.info \
  --cov-report=json:coverage.json
```

**`tests/conftest.py`**：Flask app factory + test client 夹具。

```python
from __future__ import annotations

import pytest
from flask import Flask
from flask.testing import FlaskClient

from app import create_app


@pytest.fixture
def app() -> Flask:
    return create_app({"TESTING": True})


@pytest.fixture
def client(app: Flask) -> FlaskClient:
    return app.test_client()
```

### 6.5 Flask 端到端测试（对标 Playwright 层）

分两档：**进程内**集成用 `test_client`（快）；**真端到端**用可受控的 Werkzeug 测试服务器（`werkzeug.serving.make_server`）承载真实 HTTP，再由 `httpx` 作为网络客户端访问。

> 为什么不用 `app.run()`：它是 Flask 的**开发服务器**，为单次调用设计、不易可靠关闭，用它做测试会留下无法回收的线程。`make_server` 支持端口 `0` 的原子绑定（避免"先 bind 后 close"的 TOCTOU 端口竞争）与优雅 `shutdown()`，fixture 生命周期完全受 pytest 管理。`werkzeug` 随 `flask` 安装，无需单独添加依赖。

集成（默认跑）：

```python
# tests/test_routes.py
from __future__ import annotations


def test_index_responds(client):
    resp = client.get("/")
    assert resp.status_code == 200


def test_unknown_route_404(client):
    assert client.get("/definitely-missing").status_code == 404
```

真端到端（`e2e` 标记，默认排除）：

```python
# tests/e2e/test_http_e2e.py
from __future__ import annotations

import threading
from collections.abc import Iterator

import httpx
import pytest
from werkzeug.serving import make_server

from app import create_app

pytestmark = pytest.mark.e2e


@pytest.fixture
def live_server() -> Iterator[str]:
    app = create_app({"TESTING": True})
    # port=0：由内核原子分配端口，server.server_port 返回实际绑定值
    server = make_server("127.0.0.1", 0, app)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}"
    finally:
        server.shutdown()       # 停止 serve_forever
        thread.join(timeout=5)  # 等线程退出，避免服务器/线程泄漏


def test_health_over_http(live_server: str):
    resp = httpx.get(f"{live_server}/health", timeout=5)
    assert resp.status_code == 200
```

> `make_server` 来自 `werkzeug`（随 `flask` 安装）。若服务端渲染含真实浏览器交互（表单 + JS + DOM），再额外引入 `playwright`（Python 版）作为可选第三档；`test_client` + `httpx` 已覆盖绝大多数 API/路由端到端需求。

### 6.6 CRAP 与体量门禁（`scripts/crap.py`）

**范围**：CRAP = `圈复杂度² × (1 − 覆盖率)³ + 圈复杂度`；外加**体量门禁**——文件行数、类行数、公共方法数。

**为什么体量要自制**：Ruff **没有**模块/文件行数规则（`too-many-lines` 未实现）、也**没有** `too-many-instance-attributes`（`PLR0902` 未实现）；`PLR0904`（公共方法数）属 preview。为不引入全局 preview，体量与上帝类信号统一放进本自制件（`radon cc` 已返回类的行区间与方法列表）。

**事实前提**：
- Python 生态没有可可靠推荐的现成 CRAP 工具包（`crap` / `crap4py` 等存在 PyPI 项目页，但 CLI、维护状态均无法核实），故用 `radon` + `coverage` 自算。**这是本方案唯一的自制件**，需随项目维护。
- `radon cc` 的位置参数是**文件系统路径**（不是 import 名）。其实测 CLI JSON 会把同一个方法**输出两次**（`class.methods` 里一次 + 顶层独立 `method` 块一次），因此必须按身份去重，否则方法 CRAP 会被算两遍；嵌套函数只在父函数的 `closures` 下出现一次。
- **实测局限**：`radon cc --json` **不输出嵌套类里的方法**（会漏算），见 §13。
- `coverage json` 提供 `executed_lines` 与 `missing_lines`。

**关键正确性点**：覆盖率分母只能用**可执行行**。若用函数行区间长度（包含空行/注释/docstring）当分母，会对"长而有注释但已完全覆盖"的函数**系统性高估 CRAP**。正确算法是：

```text
hit   = executed_lines ∩ [lineno, endline]
total = hit + (missing_lines ∩ [lineno, endline])
cov   = hit / total（total 为 0 时记 1.0）
```

```python
# scripts/crap.py
"""质量度量门禁：CRAP + 体量（文件 / 类）。

CRAP = 圈复杂度^2 * (1 - 覆盖率)^3 + 圈复杂度

输入：
  - radon 的逐函数/逐方法圈复杂度（按身份去重后展开 class.methods 与嵌套 closures）
  - radon 的逐类行区间与方法列表（计算类行数、公共方法数）
  - coverage json 的逐行命中（executed_lines / missing_lines）
  - 源文件物理行数（文件体量）

覆盖率只使用「可执行行」，避免空行/注释/docstring 拉低分母。
路径按「相对 cwd」归一化；radon 有而 coverage 没有的文件会显式报错（fail loud）。
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

COVERAGE_JSON = Path("coverage.json")


def _key(path: str) -> str:
    """归一化为「相对 cwd 的 POSIX 路径」，让 radon 与 coverage 的键能对上。"""
    p = Path(path).resolve()
    try:
        p = p.relative_to(Path.cwd().resolve())
    except ValueError:
        pass  # 不在 cwd 树下时保留绝对路径，不强行裁剪
    return p.as_posix()


def _callables(path: str, blocks: list[dict]) -> list[tuple[str, dict]]:
    """收集 function / method，展开 class.methods 与嵌套 closures，并按身份去重。

    radon CLI JSON 会把方法同时放进 class.methods 与顶层 method 块，故必须去重。
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
    """调用 radon，返回 {归一化路径: [顶层块, ...]}。"""
    raw = subprocess.run(
        ["radon", "cc", source, "--json", "-s"],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return {_key(path): blocks for path, blocks in json.loads(raw).items()}


def _iter_classes(raw: dict[str, list[dict]]) -> list[tuple[str, dict]]:
    """顶层 class 块（radon 不输出嵌套类，见已知限制）。"""
    return [
        (path, block)
        for path, blocks in raw.items()
        for block in blocks
        if block.get("type") == "class"
    ]


def load_blocks(source: str) -> list[tuple[str, dict]]:
    """所有 function / method 块（供 CRAP 计算与测试）。"""
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
    parser = argparse.ArgumentParser(description="CRAP 与体量门禁")
    parser.add_argument("--source", default="src/app")
    parser.add_argument("--fail-above", type=float, default=None, help="CRAP 阈值；缺省只出报告")
    parser.add_argument("--max-file-lines", type=int, default=None)
    parser.add_argument("--max-class-lines", type=int, default=None)
    parser.add_argument("--max-public-methods", type=int, default=None)
    args = parser.parse_args(argv)

    raw = load_raw(args.source)
    failures: list[str] = []

    # 体量：仅在给了对应阈值时才读文件 / 计算，避免无谓 IO
    if args.max_file_lines is not None:
        for path in sorted(raw):
            n = file_lines(path)
            if n > args.max_file_lines:
                failures.append(f"[体量] 文件 {n} 行 > {args.max_file_lines}  {path}")

    if args.max_class_lines is not None or args.max_public_methods is not None:
        for path, block in _iter_classes(raw):
            if args.max_class_lines is not None:
                n = class_lines(block)
                if n > args.max_class_lines:
                    failures.append(f"[体量] 类 {n} 行 > {args.max_class_lines}  {path}:{block['name']}")
            if args.max_public_methods is not None:
                k = public_methods(block)
                if k > args.max_public_methods:
                    failures.append(f"[体量] 公共方法 {k} 个 > {args.max_public_methods}  {path}:{block['name']}")

    # CRAP（需要 coverage.json）
    covered = load_coverage()
    pairs = [pair for path, blocks in raw.items() for pair in _callables(path, blocks)]
    missing_files = sorted({path for path, _ in pairs} - set(covered))
    if missing_files:
        raise RuntimeError(
            "coverage.json 缺少以下文件（路径不匹配或未纳入覆盖率），已中止以免产生假阴性: "
            + ", ".join(missing_files)
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
        print("仅供参考（未启用任何阈值）")
        return 0

    print(f"超限项：{len(failures)}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
```

**给脚本自身加测试**（去重、真实 radon 集成、失败路径）：

```python
# tests/test_crap_script.py
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

import pytest

CRAP_PATH = Path(__file__).resolve().parents[1] / "scripts" / "crap.py"

SAMPLE = '''
async def afunc(x):
    if x:
        return 1
    return 2


def outer():
    def inner():
        return 1

    return inner


class C:
    def method(self, x):
        if x:
            return x
        return 0


def deco(f):
    return f


@deco
def decorated(x):
    return x
'''


@pytest.fixture(scope="module")
def crap_mod():
    spec = importlib.util.spec_from_file_location("crap_script", CRAP_PATH)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def test_coverage_uses_executable_lines_only(crap_mod):
    # 10 行区间里只有 2 行可执行（1 命中、1 缺失）；空行/注释不计入分母
    block = {"lineno": 1, "endline": 10}
    assert crap_mod.function_coverage(block, executed={3}, missing={7}) == 0.5


def test_fully_covered_with_comments_stays_full(crap_mod):
    block = {"lineno": 1, "endline": 5}
    assert crap_mod.function_coverage(block, executed={2, 4}, missing=set()) == 1.0


def test_callables_dedupes_class_method(crap_mod):
    # radon 会把 method 同时放进 class.methods 与顶层 method 块，必须去重
    blocks = [
        {"type": "class", "name": "C", "methods": [
            {"type": "method", "classname": "C", "name": "m", "lineno": 2, "endline": 4},
        ]},
        {"type": "method", "classname": "C", "name": "m", "lineno": 2, "endline": 4},
        {"type": "function", "name": "outer", "lineno": 6, "endline": 9, "closures": [
            {"type": "function", "name": "inner", "lineno": 7, "endline": 8},
        ]},
    ]
    got = {b["name"] for _, b in crap_mod._callables("src/app/x.py", blocks)}
    assert got == {"m", "outer", "inner"}


def test_radon_json_real_output(crap_mod, tmp_path):
    """用真实 radon CLI 验证 JSON 结构与去重（含 async / 装饰器 / 嵌套 / 方法）。"""
    mod = tmp_path / "sample.py"
    mod.write_text(SAMPLE, encoding="utf-8")
    pairs = crap_mod.load_blocks(str(mod))
    labels = [(b.get("classname") or "", b["name"]) for _, b in pairs]
    assert labels.count(("C", "method")) == 1  # 方法不被重复计算
    names = {b["name"] for _, b in pairs}
    assert {"afunc", "outer", "inner", "method", "decorated"} <= names


def test_size_limits_gate(crap_mod, tmp_path, monkeypatch):
    """体量门禁：文件行数 / 类行数 / 公共方法数。"""
    body = ["class Big:"]
    for i in range(25):
        body += [f"    def m{i}(self):", f"        return {i}"]
    (tmp_path / "big.py").write_text("\n".join(body) + "\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    (tmp_path / "coverage.json").write_text(
        json.dumps({"files": {"big.py": {
            "executed_lines": list(range(1, len(body) + 2)),
            "missing_lines": [],
        }}}),
        encoding="utf-8",
    )

    assert crap_mod.main(["--source", "big.py"]) == 0  # 无阈值只报告
    assert crap_mod.main(["--source", "big.py", "--max-file-lines", "10"]) == 1
    assert crap_mod.main(["--source", "big.py", "--max-class-lines", "10"]) == 1
    assert crap_mod.main(["--source", "big.py", "--max-public-methods", "5"]) == 1


def test_missing_coverage_file_fails_loud(crap_mod, monkeypatch):
    """radon 扫到但 coverage 没有的文件，必须报错而不是当成 100%。"""
    monkeypatch.setattr(crap_mod, "load_raw", lambda source: {
        "src/app/x.py": [
            {"type": "function", "name": "f", "lineno": 1, "endline": 1, "complexity": 1},
        ],
    })
    monkeypatch.setattr(crap_mod, "load_coverage", lambda: {})
    with pytest.raises(RuntimeError, match="coverage.json 缺少"):
        crap_mod.main([])


def test_malformed_coverage_json_fails(crap_mod, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "coverage.json").write_text("{ not json", encoding="utf-8")
    with pytest.raises(json.JSONDecodeError):
        crap_mod.load_coverage()


def test_empty_project_reports_nothing(crap_mod, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "coverage.json").write_text(json.dumps({"files": {}}), encoding="utf-8")
    monkeypatch.setattr(crap_mod, "load_raw", lambda source: {})
    assert crap_mod.main([]) == 0
```

另外可用 `xenon` 做纯复杂度上限门禁（不涉及覆盖率）：

```bash
uv run xenon --max-absolute B --max-modules A --max-average A src/app
```

### 6.7 安全与依赖卫生

```toml
# pyproject.toml
[tool.bandit]
exclude_dirs = ["tests", ".venv", "build", "dist"]

[tool.deptry]
extend_exclude = ["build", "dist"]
```

```bash
uv run bandit -c pyproject.toml -r src/app   # 安全白盒（注意是路径，不是 import 名）
uv export --no-dev --frozen --output-file requirements-runtime.txt
uv run pip-audit -r requirements-runtime.txt # 仅生产依赖漏洞（门禁默认用它）
uv run pip-audit                             # 整个开发环境漏洞（可选额外检查）
uv run deptry .                              # 未声明/未使用/幻影依赖
```

> `pip-audit --strict` 的官方语义是 **"依赖收集失败则整个审计失败"**（`-S, --strict`），用于避免依赖集不完整时静默通过；它**不是**"对未锁定版本采用更严格漏洞判断"。
>
> **运行时 vs 开发环境**：不带 `-r` 的 `pip-audit` 审计**整个当前环境**，包含 lint/测试等 dev 依赖；一旦某个测试或 lint 工具爆出 advisory，就会阻塞业务代码的 pre-push。因此门禁默认审计**生产依赖**（`uv export --no-dev` 生成的 pinned 文件），开发环境审计作为可选的单独检查（`audit_dev`）。

### 6.8 `.pre-commit-config.yaml`（对标 husky + lint-staged）

```yaml
default_install_hook_types: [pre-commit, pre-push]

repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.16.9  # 与 ruff 同版本；用 `pre-commit autoupdate` 更新
    hooks:
      - id: ruff-check
        args: [--fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v6.0.0  # 已核实 tag；用 `pre-commit autoupdate` 升级
    hooks:
      - id: end-of-file-fixer
      - id: trailing-whitespace
      - id: check-yaml
      - id: check-toml

  - repo: local
    hooks:
      - id: prepush
        name: prepush（强门禁）
        entry: uv run poe prepush
        language: system
        pass_filenames: false
        stages: [pre-push]
```

```bash
uv run pre-commit install                       # 装 pre-commit 钩子
uv run pre-commit install --hook-type pre-push  # 单独装 pre-push 钩子
uv run pre-commit autoupdate                    # 把 rev 钉到最新 tag
```

> **关键点**：Ruff 的 lint hook id 现为 **`ruff-check`**（旧 `ruff` 已改名），这是会直接影响钩子能否运行的项。`pre-commit` 阶段只做快速自动修复；**pre-push** 阶段调用完整门禁 `poe prepush`。

### 6.9 `pyproject.toml` 的 `[tool.poe.tasks]`（对标 npm scripts）

以下为 **Phase 3 完成后**的最终形态（各阶段如何演进见 §11）：

```toml
[tool.poe.tasks]
lint = "ruff check ."
lint_fix = "ruff check . --fix"
format = "ruff format ."
format_check = "ruff format --check ."
typecheck = "mypy"

test = "pytest -m \"not e2e\""
test_all = "pytest"
e2e = "pytest -m e2e"
test_cov = "pytest -m \"not e2e\" --cov=app --cov-report=term-missing --cov-report=lcov:coverage/lcov.info --cov-report=json:coverage.json"

crap_report = "python scripts/crap.py --source src/app"
crap_gate = "python scripts/crap.py --source src/app --fail-above 6 --max-file-lines 400 --max-class-lines 300 --max-public-methods 20"

arch = "lint-imports"
sec = "bandit -c pyproject.toml -r src/app"
audit_runtime = "uv export --no-dev --frozen --output-file requirements-runtime.txt && pip-audit -r requirements-runtime.txt"
audit_dev = "pip-audit"
deps = "deptry ."

verify = ["format_check", "lint", "typecheck", "test"]
verify_full_report = ["verify", "test_cov", "crap_report"]
verify_full_gate = ["verify", "test_cov", "crap_gate", "arch", "sec", "audit_runtime", "deps"]

prepush = "verify_full_gate"
```

> **关键点 1（任务载体）**：`poe` 任务名即"分阶段命令"，等价于前端的 `npm run xxx`；用 `uv run poe <task>` 触发，无需全局安装。
>
> **关键点 2（CRAP 渐进，避免自相矛盾）**：`prepush` 指向何处、`verify_full_gate` 包含哪些项，**必须与 §11 的阶段描述一致**；Phase 1 只出 CRAP 报告，Phase 2 才转硬门禁，Phase 3 才并入 arch/sec/audit_runtime/deps。

### 6.10 忽略文件

`.gitignore`

```text
.venv/
build/
dist/
*.egg-info/
.mypy_cache/
.pytest_cache/
.ruff_cache/
.coverage
coverage/
coverage.json
requirements-runtime.txt
```

> `ruff` 的 `extend-exclude`、`mypy` 的 `exclude`、`bandit` 的 `exclude_dirs` 已在各自配置中处理生成目录，无需依赖 ignore 文件替代。

## 7. 规则 → 症状 / 目标映射表

| 目标 | 落实方式 | 状态 |
|---|---|---|
| 未解析导入（"幻影导入"） | `mypy` import-not-found（import 解析权威）+ `deptry`（第三方依赖是否声明）+ `ruff F`（名字级错误/无用导入） | **已配置**（分工，见 §6.1、§6.2、§6.7） |
| 被吞异常 | `ruff` `E722`（裸 except）、`S110`/`S112`（try-except-pass/continue） | **已配置** |
| 空实现 / 假完成桩 | `ruff` `PIE790` 只查**多余**的 `pass`/`...`（不是"函数没实现"） | **部分覆盖**（语义假实现无法可靠检测） |
| 重复 / 复制粘贴 | `ruff` `PLR0912`（分支过多）、`SIM`/`PIE` 系列只是"可简化"，**不是 clone detector** | **部分覆盖**（不检测跨函数代码克隆） |
| 复杂度（圈复杂度） | `ruff` `C901`（mccabe, 20）、`PLR0915`（语句数）、`PLR0913`（参数数）、`PLR0912`（分支数）、`PLR0911`（返回数）；`xenon` | **已配置** |
| 大文件 | 自制 metrics `--max-file-lines`（Ruff 无 `too-many-lines`） | **已配置**（§6.6） |
| 上帝类 | 自制 metrics `--max-class-lines` / `--max-public-methods`（Ruff `PLR0904` 属 preview、`PLR0902` 未实现） | **部分覆盖**（不含实例属性数） |
| 认知复杂度 | —— | **未检测**（radon 无 cognitive complexity；以圈复杂度/分支/语句数近似） |
| 循环依赖 / 分层错乱 | `import-linter` 的 `layers` / `forbidden` / `independence` | **已配置**（§6.3） |
| 类型错误 | `mypy` strict | **已配置**（§6.2） |
| 安全问题 | `ruff S`（快速近似）+ `bandit`（权威 + 可出报告） | **已配置**（§6.1、§6.7） |
| 依赖漏洞 | `pip-audit` | **已配置** |
| 依赖卫生（未用/未声明） | `deptry` | **已配置** |
| 格式化不一致 | `ruff format` | **已配置** |
| AI 味调试残留 | `ruff` `T20`（print）、`ERA`（注释掉的代码） | **已配置**（近似，非完整） |
| 叙述性注释（AI 味注释） | —— | **未覆盖**（§13） |
| 样式 / 设计 token | —— | **不适用**（除非服务端渲染含独立 CSS，§13） |

### SOLID 逐条覆盖（诚实说明：SOLID 是设计原则，无工具能直接检查）

| 原则 | 近似手段 |
|---|---|
| S 单一职责 | `ruff` `C901` / `PLR0915` / `PLR0913` / `PLR0402` |
| O 开闭 | **无自动规则**（评审 + 测试） |
| L 里氏替换 | **无自动规则**（评审 + 测试） |
| I 接口隔离 | `import-linter` 的 `independence` 契约限制模块依赖面 |
| D 依赖倒置 | `import-linter` 的 `layers` / `forbidden` 契约限制跨层依赖 |

## 8. 测试与 CRAP

### 8.1 分层

- **单元**：纯函数/工具，`pytest`。
- **集成**：Flask `test_client` 打路由、真实文件/子进程，`pytest`。
- **端到端**：Werkzeug `make_server` 测试服务器 + `httpx` 网络客户端，跨网络栈（§6.5）；有真实浏览器交互再叠加 Playwright。

### 8.2 CRAP 与体量门禁

- **CRAP 公式**：`CRAP = 复杂度² × (1 − 覆盖率)³ + 复杂度`，复杂度取 McCabe 圈复杂度。
- **输入**：`coverage json` 生成的 `coverage.json`（由 `test_cov` 任务产生），分母只用**可执行行**。
- **工具**：`radon` + `coverage` + 自制 `scripts/crap.py`（§6.6）。
- **CRAP 阈值：≤ 6**。注意这是**本方案采用的严格工程政策**：经典 CRAP 常见风险线是 30，Uncle Bob 在 AI 辅助测试时代主张把函数压到 6 以下；二者必须区分，不要把 6 说成"行业标准"。
- **体量阈值**：文件 ≤ 400 行、类 ≤ 300 行、公共方法 ≤ 20（同一脚本 `--max-file-lines` / `--max-class-lines` / `--max-public-methods`）。
- **命令**：`uv run poe crap_gate`（任一超限即失败）。

### 8.3 渐进策略

仓库初始测试极少时，直接设死阈值会全线爆红。策略：

1. 复杂度先放宽（`ruff` `C901` 阈值 20）；
2. 覆盖率**先只出报告**（不设全局阈值），CRAP 与体量只出报告（`crap_report`）；
3. 补测试 → 逐步把复杂度收到 15、把 CRAP 阈值收紧到 6、体量阈值收紧到目标值，并转为硬门禁（`prepush` 改指 gate，见 §11）。

## 9. 本地门禁流程（无 CI）

### 9.1 `pre-commit`（快速反馈）
`pre-commit`：对暂存文件跑 `ruff-check --fix` / `ruff-format` / 空白与文件尾修复。

### 9.2 `push` 之前（强门禁）
`pre-push` 钩子调用 `uv run poe prepush`。内容随阶段演进（§11）：Phase 1 = `verify` + `test_cov` + `crap_report`（只出报告）；Phase 2 起转为 `crap_gate`；Phase 3 并入 `arch` / `sec` / `audit_runtime` / `deps`。失败即中止，符合"问题在 push 前本地处理"。

### 9.3 端到端（不进门禁）
`uv run poe e2e` 单独运行，在发 PR 前手动执行。

### 9.4 mutation testing（不定时，非门禁）
变异测试迁移成本高、耗时，**不属于本门禁**，按需（如版本发布前、专项加固时）不定期执行（如 `mutmut`）。本文档不展开。

## 10. 接入 AI 工作流

本地开发已由 AI 驱动，因此把上述命令按"任务阶段"绑定：AI 每完成一个阶段就调用对应命令，而不是等到最后。

### 10.1 阶段 → 命令

| 阶段 | 动作 | 命令 |
|---|---|---|
| 探索 / 设计 | 只读、不改码 | 不跑门禁 |
| 实现中（改动未稳定） | 只跑**受影响**的最小检查 | `uv run ruff check <file> --fix`、`uv run pytest <file>`、`uv run mypy <file>` |
| 一个阶段/子任务完成 | 全量静态 + 测试 | `uv run poe verify` |
| 收尾（提交前） | 完整本地门禁 | `uv run poe prepush` |
| 改了路由 / 模板 / 中间件 | 端到端 | `uv run poe e2e` |
| 依赖变动 | 依赖卫生 + 漏洞 | `uv run poe deps`、`uv run poe audit_runtime`（可选 `audit_dev`） |
| 不定时 | mutation | 按需，非门禁 |

### 10.2 可复制到 `AGENTS.md` 的片段

```md
## 质量门禁（本地，push 前）

本地开发由 AI 驱动，按阶段调用，不要等到最后：

- 实现中：只跑受影响的最小检查（单文件 ruff check、相关 pytest、`uv run mypy <file>`）。
- 每个阶段/子任务完成：`uv run poe verify`（format_check + lint + typecheck + test）。
- 提交/推送前：`uv run poe prepush`（Phase 2 起含 CRAP 硬门禁；Phase 3 起含 arch/sec/audit_runtime/deps），失败即修复后重跑，不得绕过。
- 改了路由/模板/中间件：发 PR 前跑 `uv run poe e2e`。
- 改了依赖：跑 `uv run poe deps` 与 `uv run poe audit_runtime`（可选 `audit_dev`）。
- CRAP 目标阈值 ≤ 6（本方案采用的严格工程政策；测试补齐前以报告为准）。
- mutation 测试不定期执行，不在门禁内。
- 不得为了让门禁通过而删测试或削弱生产代码。
```

## 11. 分阶段落地

**Phase 1（基础，一次到位）**
1. `uv init --name app` + `uv python pin 3.13`，`requires-python = ">=3.13"`。
2. 配 `[tool.ruff]`（lint + format，`E/F/I/B/C90/SIM/PL/RUF/S/T20/ERA/PTH/RET/PIE/ARG/TID/ANN`）。
3. 配 `[tool.mypy]`（先非 strict 或仅 `src` strict）。
4. 组件/单元测试跑通 + 覆盖率输出 LCOV 与 JSON。
5. 任务：`verify = format + lint + typecheck + test`；`prepush = verify + test_cov + crap_report`（**只出 CRAP 与体量报告，不失败**）。
- **验收**：`uv run poe prepush` 能跑通并给出 CRAP 与体量报告（**不含** arch/sec/audit_runtime/deps）。

**Phase 2**
`mypy` 全量开启 `strict`；新增 `verify_full_gate = verify + test_cov + crap_gate`，并把 `prepush` 指向它，让 CRAP 与体量转为硬门禁。
- **验收**：`uv run poe typecheck` 与 `uv run poe lint` 同时通过；`uv run poe prepush` 会因 CRAP/体量超阈值而失败。

**Phase 3**
把 `arch` / `sec` / `audit_runtime` / `deps` 并入 `verify_full_gate`（`prepush` 指向不变，只是 gate 定义扩展）；同时加入 `import-linter` 契约（§6.3）。
- **验收**：`uv run poe arch`、`uv run poe sec`、`uv run poe audit_runtime`、`uv run poe deps` 均通过且无新增 error。

**贯穿**：端到端（§6.5）与测试补齐可并行推进；CRAP 阈值随时间收紧到 6。

> **一致性要求**：`prepush` 指向与各组件的阶段归属，必须与本节描述和 §6.9 的任务定义三者一致；这是上一版最容易自相矛盾的地方。

## 12. 选型与取舍（原 ADR 内容）

- **为什么 uv**：单工具管理解释器 + 虚拟环境 + 依赖 + 锁文件（`uv.lock`），速度快、`pyproject.toml` 为中心，替代 pip/venv/poetry 的组合。
- **为什么 Ruff 一体化**：`ruff check` + `ruff format` 取代 flake8 / isort / black / 大部分 pylint，配置集中、极快；格式与 lint 同源，冲突少。
- **为什么 mypy 而非 ty / pyright**：mypy 仍是当前最成熟、稳定、生态最广的默认选择，适合做硬门禁。`pyright` 强在编辑器（Pylance）；`ty` 是 Astral 新出的 Rust 类型检查器，比 mypy/Pyright 快 10–100 倍，但仍是 `0.0.x` beta、API 与诊断不稳定，暂不入门禁（见 §13）。
- **为什么不引入不明 CLI / 重型规则集**：`pylint` 规则成熟但重型且为 **GPL-2.0-or-later**；把坏味道落到 Ruff 的确定性规则上，更轻、更快、许可证更干净。
- **为什么 CRAP 自算**：Python 无可靠现成 CRAP 包，`radon` + `coverage` 凑公式是唯一可核实路径；代价是需维护一个小脚本，并**只用可执行行**做分母。
- **为什么 `ruff S` 与 `bandit` 并存**：`ruff S` 提供编辑器内即时近似反馈；`bandit` 作为权威扫描并能出报告。二者规则集是子集关系，不冲突（见 §13 的去重建议）。
- **为什么用 `import-linter` 近似 SOLID**：SOLID 无直接检查器，但 D/I 可落成确定性的依赖方向契约（`layers`/`forbidden`/`independence`）。
- **为什么用 DDD 四层而非 MVC 式 views/services/models**：把领域逻辑与 Web 框架解耦，`domain` 可脱离 Flask 独立测试；分层方向与框架隔离都能落成 import-linter 的可执行契约（§2.2、§6.3），比纯目录约定更硬。
- **为什么不启用 Ruff preview 拿上帝类/局部变量规则**：`preview = true` 是全局开关，会一次性激活所有 preview 规则、带来不稳定与噪声；文件/类体量与公共方法数等缺口改由确定性的自制 metrics 覆盖（§6.6）。
- **为什么 Flask 端到端用 `test_client` + `httpx` 而非默认 Playwright**：API/路由端到端用 `test_client` 与真实 HTTP（`httpx`）就能覆盖，成本低、无浏览器依赖；只有服务端渲染含真实浏览器交互时才值得引入 Playwright。
- **为什么 `pre-commit` 而非 husky**：Python 生态原生、声明式、支持 `local` hook 调用完整门禁，跨平台无需 node。
- **为什么 `poethepoet` 而非 Makefile**：跨平台（含 Windows）、任务定义与 `pyproject.toml` 同源，避免 `make` 依赖。
- **为什么暂不做 CI**：本地优先；CI 是后续独立阶段。
- **为什么 CRAP 阈值 6**：采用 AI 辅助测试时代更严的**工程政策**（经典风险线为 30），把复杂度与覆盖率绑成一个可门禁指标。
- **为什么 mutation 不进门禁**：耗时且不稳定，属不定时专项任务。

## 13. 已知未覆盖 / 待办

1. **无可靠现成 CRAP 工具包**：`scripts/crap.py` 是自制件，覆盖率用**可执行行**近似（区间内 executed/missing 交集），已按身份去重 radon 的重复 method 输出、对 coverage 缺失文件显式报错（fail loud）、并扩展为 CRAP + 体量（文件/类行数、公共方法数）门禁；仍需随项目维护，配套真实 radon 集成测试与失败路径测试（§6.6）。
2. **认知复杂度未检测**：`radon` 只提供圈复杂度 / Halstead / MI / raw，无 cognitive complexity；只能以圈复杂度、分支数、语句数近似。
3. **代码克隆未检测**：`ruff` 无 clone detector；现有 `PLR`/`SIM`/`PIE` 只覆盖"过长/可简化"，跨函数复制粘贴需另配工具或评审。
4. **语义假完成桩**：`PIE790` 只查多余的 `pass`/`...`，不能可靠识别"函数实际没实现"。
5. **SOLID 的 O / L**（开闭、里氏替换）无法自动化，只能评审 + 测试。
6. **叙述性注释**（AI 味注释）无成熟确定性规则；仅以 `T20`（print）与 `ERA`（注释掉代码）做近似，明确留白。
7. **精确依赖版本未锁定**：本文档未给各包 patch 版本，应在目标项目用 `uv lock` 现场解析，以各包 `requires-python` 为准。
8. **`pylint` 为 GPL-2.0-or-later**（非宽松许可），若评估引入需自行确认合规。
9. **`ty` 为 beta**：`0.0.x`，诊断与 API 会变；引入前先评估。
10. **`ruff S` 与 `bandit` 规则重叠**：如需去重，可在 `[tool.ruff.lint]` 的 `ignore` 中关掉 `S`，只保留 `bandit`；本方案默认共存以兼顾即时反馈。
11. **`pip-audit` 审计对象**：不带 `-r` 时审计整个开发环境（含 dev 依赖）；门禁默认只审计生产依赖（`uv export --no-dev` + `pip-audit -r`），dev 审计作为可选 `audit_dev`，避免测试/工具链 advisory 阻塞业务 push。
12. **样式 / 设计 token 层不覆盖**：仅当服务端渲染含独立 CSS 时才需要，参照前端工具链（stylelint 等）另建。
13. **端到端受端口/环境限制**：§6.5 已改用 `make_server` 原子绑定空闲端口并优雅关闭，消除端口竞争与线程泄漏；但受限沙箱仍可能禁止监听端口，需按环境放宽或跳过。
14. **CI 门禁**：属后续独立阶段。
15. **可选增强（未写入配置，按需启用）**：`commitizen`（等价 commitlint）、`pytest-randomly`、`hypothesis`（属性测试）、`ruff` 的 `ANN` 全量强制执行、`playwright`（真实浏览器 E2E）、`mutmut`（变异测试，非门禁）。
16. **radon 不输出嵌套类方法**：实测 `radon cc --json` 只输出顶层 class 及其直接方法，嵌套类（`class Inner:`）内的方法会漏算，CRAP 覆盖不到这类方法，需评审兜底。
17. **Windows 控制台中文输出**：`scripts/crap.py` 的 `print` 含中文，在非 UTF-8 代码页的终端可能显示乱码；用 `PYTHONUTF8=1` 或 `python -X utf8` 可避免（仅影响显示，不影响计算与退出码）。
18. **目录存在性不被强制**：import-linter 只约束**已存在模块**的导入关系，空目录或缺失分层不会报错；"DDD 四层目录始终齐全"靠评审兜底，或用 import-linter `containers` + `exhaustive`（需改为多容器结构）把"每个模块都必须归入某层"变成可执行约束。
19. **Ruff 体量能力缺口**：模块/文件行数（`too-many-lines`）与实例属性数（`PLR0902`）Ruff **未实现**；`PLR0904`（公共方法数）/`PLR0914`（局部变量）/`PLR0916`/`PLR1702` **属 preview**。本方案不开全局 preview，故文件/类体量与公共方法数由自制 metrics 覆盖（§6.6），**实例属性数不覆盖**。
