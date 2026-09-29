# 前端质量工具链（Vue 3 + TypeScript + Pinia + SCSS，FSD 结构）

> 一份**可迁移**的本地质量工具链说明：把它整体搬到任意 Vue 3 + TS 前端项目即可使用。
> 推荐目录结构采用 **Feature-Sliced Design（FSD）**；本文档自包含，不依赖任何特定仓库或内部工作流契约。

## 0. 一句话总结

用一套**社区最佳实践**命名的 npm 脚本，把「代码质量 + 坏味道 + AI slop + FSD 架构/目录结构 + 依赖方向 + 大文件/大组件 + 样式一致性 + 测试 + CRAP」装进本地门禁，在 `push` 之前就能拦住问题；CI 与 mutation 测试不属本门禁范畴。

## 1. 适用与边界

- **适用**：Vue 3 + TypeScript + Pinia + SCSS 的前端项目（Vite 构建），**目录结构推荐 FSD**。
- **参考案例**：AutoReportView（`src/` 下 40 个 `.vue`、29 个 `.ts`、7 个 Pinia store、SCSS 变量）。**注意：其现有目录不是 FSD**，故「迁移到 FSD」列为参考项目的可选重构项（非本次执行，见 §13）。
- **包含**：静态 lint、坏味道、AI slop、FSD 架构与目录结构、依赖方向、大文件/大组件约束、样式与设计一致性、单元/组件测试、E2E、CRAP 门禁。
- **不包含**：CI 流水线（另一阶段）、mutation testing（属不定时任务，见 §9.4）。

## 2. Node 基线与版本回退表

**基线：Node 22 LTS（≥ 22.18）。** 建议在项目根加 `.nvmrc`（内容 `22`）与 `package.json` 的 `engines`：

```json
"engines": { "node": ">=22.18" }
```

> 基线取 `≥ 22.18` 是因为 `steiger` 要求 `node >= 22.18`；其余工具在 Node 22 下均满足。

若迁移到更低 Node 环境，按此表回退各工具 major：

| Node | ESLint | typescript-eslint | stylelint | vitest | @playwright/test | style-dictionary | stylelint-config-recommended-vue |
|---|---|---|---|---|---|---|---|
| **22 LTS** | 10 | 8 | 17 | 5 | 1.x | 5 | 2 |
| 20.x | 9（^20.19 亦可用 10） | 8 | 16 | 3 | 1.x | 4 | 1 |
| 18.x | 9 | 8（^18.18） | 15 | 1 | 1.x（≥18） | 4 | 1 |

> 表中的低版本列为回退方向，**不要混用**：一次只降一个工具链层级，并以各包 `engines` 字段为准。注意 `steiger` 无低版本回退（仅支持 Node ≥22.18）。

## 3. 分层总览

| 层 | 工具 | 职责 | 许可证 |
|---|---|---|---|
| 核心 lint | `eslint` + `@eslint/js` + `typescript-eslint` + `eslint-plugin-vue` + `vue-eslint-parser` + `globals` | JS/TS/Vue 基础规则、文件/函数/组件体积 | MIT |
| 框架/库 | `eslint-plugin-pinia` | Pinia 约定 | MIT |
| 坏味道 | `eslint-plugin-sonarjs` | 复杂度、重复、无用 catch 等 | **LGPL-3.0-only** |
| 依赖/幻影导入 | `eslint-plugin-import-x` + `eslint-import-resolver-typescript` | 未解析导入 | MIT |
| 架构 / 目录结构（FSD） | `steiger` + `@feature-sliced/steiger-plugin` | FSD 层序、切片、公共 API、跨层/跨切片导入 | MIT |
| 依赖方向 / 循环依赖 | `dependency-cruiser`（+ `eslint-plugin-boundaries` 可选） | 循环依赖、孤儿模块、自定义 forbidden | MIT |
| 目录 / 文件命名 | `@ls-lint/ls-lint` | 目录与文件命名 | MIT |
| 样式与设计一致性 | `stylelint` + `stylelint-order` + `stylelint-config-recess-order` + `stylelint-declaration-strict-value` + `style-dictionary` | 排序 + 强制引用 token + token 构建 | MIT / ISC / Apache-2.0 |
| 测试与 CRAP | `vitest` + `@vitest/coverage-v8` + `@vue/test-utils` + `@pinia/testing` + `happy-dom` + `ts-crap` | 单元/组件测试、覆盖率、CRAP | MIT |
| E2E | `@playwright/test` + `dotenv` | 跨浏览器端到端 + 环境变量加载 | Apache-2.0 / BSD-2-Clause |
| 格式 | `prettier` + `eslint-config-prettier` | 代码格式化（与 ESLint 分离） | MIT |

## 4. 依赖与许可证清单（npm 最新版，2026-09 核实）

| 包 | 版本 | 许可证 |
|---|---|---|
| `eslint` | 10.11.0 | MIT |
| `@eslint/js` | 10.0.1 | MIT |
| `typescript-eslint` | 8.71.0 | MIT |
| `eslint-plugin-vue` | 10.11.1 | MIT |
| `vue-eslint-parser` | 10.4.1 | MIT |
| `globals` | 17.12.0 | MIT |
| `eslint-plugin-sonarjs` | 4.2.2 | **LGPL-3.0-only** |
| `eslint-plugin-import-x` | 4.17.1 | MIT |
| `eslint-config-prettier` | 10.1.8 | MIT |
| `eslint-plugin-pinia` | 0.4.2 | MIT（维护风险，见 §12） |
| `pinia` | 4.0.3 | MIT（参照值；版本按项目） |
| `@pinia/testing` | 2.0.1 | MIT（**major 必须匹配 `pinia`**：pinia 4 → 2.x；pinia 2 → 0.1.x） |
| `@vue/test-utils` | 2.5.1 | MIT |
| `happy-dom` | 20.14.5 | MIT |
| `stylelint` | 17.15.0 | MIT |
| `stylelint-order` | 8.1.1 | MIT |
| `stylelint-config-recess-order` | 7.8.0 | ISC |
| `stylelint-config-standard-scss` | 17.0.0 | MIT |
| `stylelint-config-recommended-vue` | 2.0.0 | MIT |
| `stylelint-scss` | 7.3.0 | MIT |
| `stylelint-declaration-strict-value` | 1.12.1 | MIT |
| `style-dictionary` | 5.5.5 | Apache-2.0 |
| `vitest` | 5.0.2 | MIT |
| `@vitest/coverage-v8` | 5.0.2 | MIT |
| `@playwright/test` | 1.63.0 | Apache-2.0 |
| `dotenv` | 18.0.4 | **BSD-2-Clause** |
| `ts-crap` | 1.0.0 | MIT |
| `steiger` | 0.7.0 | MIT（**beta**，见 §13） |
| `@feature-sliced/steiger-plugin` | 0.8.0 | MIT（beta） |
| `dependency-cruiser` | 18.4.0 | MIT |
| `eslint-plugin-boundaries` | 7.2.0 | MIT |
| `@ls-lint/ls-lint` | 2.3.1 | MIT |
| `prettier` | 3.9.9 | MIT |

> `eslint-import-resolver-typescript`、`typescript`、`vue-tsc` 的版本随各自工具链兼容，安装时以 peer / 项目现有版本为准。

## 5. 安装命令

```bash
# 语言与类型检查基础（版本随 Vue 3 工具链，按项目情况锁定）
npm i -D typescript vue-tsc

# 核心 lint（版本对齐 §4）
npm i -D eslint@^10.11.0 @eslint/js@^10.0.1 typescript-eslint@^8.71.0 \
        eslint-plugin-vue@^10.11.1 vue-eslint-parser@^10.4.1 globals@^17.12.0

# 坏味道 / 依赖 / 格式
npm i -D eslint-plugin-sonarjs@^4.2.2 eslint-plugin-import-x@^4.17.1 \
        eslint-import-resolver-typescript prettier@^3.9.9 eslint-config-prettier@^10.1.8

# 样式与设计一致性
npm i -D stylelint@^17.15.0 stylelint-config-standard-scss@^17.0.0 \
        stylelint-config-recommended-vue@^2.0.0 stylelint-order@^8.1.1 \
        stylelint-config-recess-order@^7.8.0 stylelint-declaration-strict-value@^1.12.1 \
        style-dictionary@^5.5.5

# 测试与 CRAP（@pinia/testing 的 major 必须与项目的 pinia major 一致）
npm i -D vitest@^5.0.2 @vitest/coverage-v8@^5.0.2 @vue/test-utils@^2.5.1 \
        @pinia/testing@^2 happy-dom@^20.14.5 ts-crap@^1.0.0

# E2E（dotenv 用于加载 .env.e2e）
npm i -D @playwright/test@^1.63.0 dotenv@^18.0.4 && npx playwright install

# FSD 架构 / 目录结构
npm i -D steiger@^0.7.0 @feature-sliced/steiger-plugin@^0.8.0

# 依赖方向 / 循环依赖 + 目录命名
npm i -D dependency-cruiser@^18.4.0 @ls-lint/ls-lint@^2.3.1

# Pinia 插件（Phase 3）
npm i -D eslint-plugin-pinia@^0.4.2
```

## 6. 可复制配置

### 6.1 `eslint.config.mjs`（ESLint 10 / flat，社区标准组合）

```js
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import sonarjs from 'eslint-plugin-sonarjs'
import importX from 'eslint-plugin-import-x'
import eslintConfigPrettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist/**', 'coverage/**', 'node_modules/**',
      'crap-report/**', 'playwright-report/**', 'test-results/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  sonarjs.configs.recommended,
  importX.flatConfigs.recommended,

  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    settings: {
      'import-x/resolver': { typescript: true },
      // 让 import-x 认识 .vue 导入，避免 `import X from '@/…/X.vue'` 误报未解析
      'import-x/extensions': ['.js', '.mjs', '.ts', '.vue'],
    },
    rules: {
      // 幻影导入：直接拦截
      'import-x/no-unresolved': 'error',
      // 坏味道：循序渐进（见 §8.3、§11）
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/no-duplicate-string': 'warn',
      // 假完成桩 / 被吞异常
      '@typescript-eslint/no-empty-function': 'warn',
      'no-empty': ['error', { allowEmptyCatch: false }],
      // 大函数（初始 warn，稳定后升 error）
      'max-lines-per-function': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],
    },
  },

  // 仅 .ts：文件长度（.vue 的整文件长度交给 vue/max-lines-per-block，避免重复计数）
  {
    files: ['**/*.ts'],
    rules: {
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },

  // .vue：大组件按块限制（template / script / style）
  {
    files: ['**/*.vue'],
    rules: {
      'vue/max-lines-per-block': [
        'warn',
        { template: 300, script: 300, style: 200, skipBlankLines: true },
      ],
    },
  },

  // 必须最后：关闭与 Prettier 冲突的规则
  eslintConfigPrettier,
)
```

> **大文件 / 大组件阈值（初始值，可调）**：单文件 ≤ 400 行、单函数 ≤ 100 行、SFC `<template>`/`<script>` ≤ 300 行、`<style>` ≤ 200 行。全部先 `warn`，稳定后升 `error`（见 §8.3）。

**Phase 2 追加（type-aware）**——在数组里加入：

```js
tseslint.configs.recommendedTypeChecked,
{
  languageOptions: { parserOptions: { projectService: true } },
},
```

**Phase 3 追加（Pinia）**——加入：

```js
import pinia from 'eslint-plugin-pinia'
// ...
pinia.configs['recommended-flat'],
```

> 已验证的导出名：`pluginVue.configs['flat/recommended']`（数组，需展开）、`sonarjs.configs.recommended`、`importX.flatConfigs.recommended`、`tseslint.configs.recommendedTypeChecked`、`pinia.configs['recommended-flat']`。

### 6.2 `.stylelintrc.json`（排序 + 强制引用 token）

```json
{
  "extends": [
    "stylelint-config-standard-scss",
    "stylelint-config-recommended-vue/scss",
    "stylelint-config-recess-order"
  ],
  "plugins": [
    "stylelint-order",
    "stylelint-declaration-strict-value"
  ],
  "rules": {
    "at-rule-no-unknown": null,
    "scale-unlimited/declaration-strict-value": [
      ["color", "fill", "stroke", "background-color", "border-color"],
      {
        "ignoreVariables": true,
        "ignoreValues": ["transparent", "currentColor", "inherit", "initial", "unset", "none", "auto"],
        "expandShorthand": true,
        "recurseLonghand": true
      }
    ]
  }
}
```

> `scale-unlimited/declaration-strict-value` 支持 SCSS 变量（`$color-white`、`namespace.$color-white`）作为允许值。
>
> **局限（重要）**：`ignoreVariables: true` 会放行**任意** SCSS 变量，包括非 token 的 `$my-random-color`。因此当前配置能拦住**硬编码颜色**，但拦不住「随意发明变量」。若目标是「只允许设计 token」，需进一步：
> - 统一 token 命名空间（如 `$color-*`、`$space-*`），并在团队约定 + 评审中约束；
> - 或在此基础上叠加自定义 ESLint 规则 / 脚本，校验 SCSS 变量声明只在 token 文件内出现。
> 本文档采用前者（约定 + 评审），并在 §13 标注该限制。

### 6.3 设计 token（源 JSON → SCSS 变量）

**源：`tokens/color.json`**

```json
{
  "color": {
    "primary":   { "value": "#333752" },
    "primary-light": { "value": "#3953a4" },
    "font":      { "value": "#ffffff" },
    "background": { "value": "#f9f7f6" }
  }
}
```

**构建：`sd.config.mjs`**（用 `.mjs` 使其始终按 ESM 解析，不依赖 `package.json` 的 `"type": "module"`；若项目已声明 `"type": "module"`，`.js` 亦可）

```js
export default {
  source: ['tokens/**/*.json'],
  platforms: {
    scss: {
      transformGroup: 'scss',
      buildPath: 'src/shared/config/tokens/',
      files: [{ destination: '_tokens.scss', format: 'scss/variables' }],
    },
    // 供 JS/图表用色（echarts 等）：用一个自定义 format 输出 TS 常量，
    // 具体 format 名以后再按 style-dictionary 5.x 文档确认
  },
}
```

生成 `_tokens.scss` 后，在全局样式入口 `@use 'tokens' as *;`，使 `$color-primary` 等全局可用，再由 §6.2 的 strict-value 规则强制组件只能引用这些变量。

> 生成文件 `src/shared/config/tokens/_tokens.scss` 已加入 `.stylelintignore`（见 §6.10），避免对机器生成的变量文件重复 lint。

### 6.4 `vitest.config.ts`（覆盖率输出 LCOV，供 CRAP 用）

```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      globals: true,
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: './coverage',
        include: ['src/**/*.{ts,vue}'],
        exclude: ['src/**/*.d.ts'],
      },
    },
  }),
)
```

> `tests/setup.ts`：若无全局 setup，可建**空文件**即可；如需全局 `@vue/test-utils` 配置、`matchMedia` / `ResizeObserver` mock 等，写在这里。示例：
>
> ```ts
> import { config } from '@vue/test-utils'
> import { vi } from 'vitest'
>
> vi.stubGlobal('matchMedia', (query: string) => ({
>   matches: false, media: query, onchange: null,
>   addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
> }))
> config.global.stubs = {}
> ```

### 6.5 `playwright.config.ts`（跨浏览器 + 登录态复用）

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // 注意：storageState 不放在全局 use，否则 setup 项目自身也会尝试加载它而失败
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: 'playwright/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
```

**登录流程：`e2e/auth.setup.ts`**（Playwright 官方推荐的 setup project + `storageState`）

```ts
import dotenv from 'dotenv'
import { test as setup, expect } from '@playwright/test'

// 显式加载 .env.e2e —— dotenv 默认只读 .env，不会读 .env.e2e
dotenv.config({ path: '.env.e2e' })

if (!process.env.E2E_USER || !process.env.E2E_PASSWORD) {
  throw new Error('缺少 E2E_USER / E2E_PASSWORD，请检查 .env.e2e')
}

const authFile = 'playwright/.auth/user.json'

setup('authenticate', async ({ page }) => {
  await page.goto('/#/login')
  await page.getByLabel('用户名').fill(process.env.E2E_USER!)
  await page.getByLabel('密码').fill(process.env.E2E_PASSWORD!)
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/report|home/)
  await page.context().storageState({ path: authFile })
})
```

账号通过 `.env.e2e` 提供，由 `dotenv` 显式加载。**新建 `.env.e2e`**（不入库，已加入 `.gitignore`），内容示例；可另建 **`.env.e2e.example`**（入库，供他人参照）：

```text
E2E_USER=<测试账号>
E2E_PASSWORD=<测试密码>
```

登录态存于 `localStorage` 的 token 会被 `storageState` 一并捕获；登录失效时用 `npm run test:e2e:auth` 重新生成。`.gitignore` 需加入：

```text
.env.e2e
playwright/.auth/
coverage/
crap-report/
test-results/
playwright-report/
```

### 6.6 `.dependency-cruiser.cjs`（依赖方向 / 循环依赖）

> FSD 的**层序与跨切片导入**由 `steiger` 负责（§6.11）；`dependency-cruiser` 保留用于**循环依赖、孤儿模块**等语言层依赖卫生，避免与 Steiger 规则重叠。

```js
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: ['\\.d\\.ts$', '(^|/)main\\.ts$', '(^|/)vite\\.config\\.'] },
      to: {},
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
  },
}
```

### 6.7 `.prettierrc`（沿用现有风格）

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 4,
  "printWidth": 120,
  "trailingComma": "none",
  "vueIndentScriptAndStyle": true,
  "singleAttributePerLine": true,
  "endOfLine": "auto"
}
```

### 6.8 husky + lint-staged（pre-commit 自动修复 + pre-push 门禁）

```json
{
  "lint-staged": {
    "*.{ts,tsx,vue}": ["eslint --fix", "prettier --write"],
    "*.{css,scss,vue}": ["stylelint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

```bash
npm i -D husky lint-staged && npx husky init
echo "npx lint-staged" > .husky/pre-commit
echo "npm run prepush" > .husky/pre-push   # 关键：npm 不会因 git push 自动触发 prepush
```

> **husky 版本差异**：以上是 husky **v9** 写法（不需要 shebang 与 `husky.sh` source 行）。若用 husky **v8**，需在 `.husky/pre-commit` / `.husky/pre-push` 文件首行补：
> ```sh
> #!/usr/bin/env sh
> . "$(dirname -- "$0")/_/husky.sh"
> ```
>
> 参考项目当前用 `yorkie` + 内联 hooks；社区最佳实践是 `husky`，迁移时二选一即可。

### 6.9 `package.json` 脚本（社区命名约定）

```json
{
  "scripts": {
    "dev": "vite",
    "build": "npm run typecheck && vite build",
    "preview": "vite preview",

    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "lint:style": "stylelint \"src/**/*.{css,scss,vue}\"",
    "lint:style:fix": "stylelint \"src/**/*.{css,scss,vue}\" --fix",
    "lint:structure": "ls-lint",
    "lint:fsd": "steiger ./src",
    "typecheck": "vue-tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "arch": "depcruise src --config .dependency-cruiser.cjs",
    "tokens:build": "style-dictionary build --config sd.config.mjs",

    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",

    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:auth": "playwright test --project=setup",

    "crap:report": "ts-crap ./src --lcov coverage/lcov.info --format html --output crap-report/index.html",
    "crap:check": "ts-crap ./src --lcov coverage/lcov.info --threshold 6 --fail-above",

    "verify:quick": "npm run format:check && npm run lint && npm run lint:style && npm run lint:structure && npm run lint:fsd && npm run typecheck",
    "verify": "npm run verify:quick && npm run test",
    "verify:full:report": "npm run verify && npm run test:coverage && npm run crap:report && npm run arch",
    "verify:full:gate": "npm run verify && npm run test:coverage && npm run crap:check && npm run arch",
    "prepush": "npm run verify:full:report",

    "prepare": "husky"
  }
}
```

> **关键点 1**：`eslint .` 取代旧式 `eslint --ext .ts,.vue,.tsx`（`--ext` 在 flat config 下已移除）。
>
> **关键点 2（CRAP 渐进，避免自相矛盾）**：Phase 1 的 `prepush` 指向 `verify:full:report`（只出报告，不失败）。待测试补齐后，把 `prepush` 改为指向 `verify:full:gate`，CRAP 才成为硬门禁——**只需改一行指向，不再手工替换命令**。**不要**在 Phase 1 就用 gate，否则全新项目会因存量复杂函数直接失败。

### 6.10 忽略文件

`.prettierignore`

```text
dist/
coverage/
crap-report/
playwright-report/
test-results/
*.min.*
```

`.stylelintignore`

```text
dist/
coverage/
src/shared/config/tokens/_tokens.scss
```

> `_tokens.scss` 是 `tokens:build` 生成的变量文件，排除以避免对生成文件重复 lint。

### 6.11 FSD 目录结构与约束（Steiger + ls-lint）

**推荐结构（Feature-Sliced Design）**

```text
src/
  app/          # 应用入口、路由、providers、全局配置
  pages/        # 页面级组合
  widgets/      # 可选，大型独立 UI 块
  features/     # 业务功能，如 auth、cart、comment
    auth/
      api/
      components/
      hooks/
      model/
      index.ts
  entities/     # 可选，业务实体，如 user、product
  shared/       # 无业务依赖的通用层
    ui/
    lib/
    api/
    hooks/
    config/
    types/
```

**FSD 依赖规则（由 `steiger` 检查）**：层只能**向下**依赖 `app → pages → widgets → features → entities → shared`；同层不同 slice **不得互相 import**；跨 slice 只能经由其公共 API（`index.ts`）。

> **段名说明**：以上段名（`api` / `components` / `hooks` / `model` / `index.ts`）沿用你的约定。FSD 规范段名为 `ui` / `lib` / `api` / `model` / `config`，两者皆可，团队二选一并保持一致。

**Steiger 配置 `steiger.config.ts`**

```ts
import { defineConfig } from 'steiger'
import fsd from '@feature-sliced/steiger-plugin'

export default defineConfig([
  ...fsd.configs.recommended,
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'] },
])
```

> 运行：`npm run lint:fsd`（即 `steiger ./src`）。Steiger 内置 FSD 规则，包括 `fsd/forbidden-imports`（禁跨层/同层跨切片导入）、`fsd/public-api`（要求切片有公共 API）、`fsd/no-segmentless-slices`、`fsd/no-public-api-sidestep`、`fsd/inconsistent-naming` 等；可用 `steiger.config.ts` 逐条开关。

**目录 / 文件命名 `.ls-lint.yml`**（与 FSD 段结构配合）

```yaml
ls:
  # 全局默认：目录 kebab-case；TS 文件 camelCase
  .dir: kebab-case
  .ts: camelCase

  # UI 段：组件 PascalCase.vue
  src/shared/ui:
    .vue: PascalCase
  src/**/components:
    .vue: PascalCase

  # 逻辑段：camelCase
  src/**/hooks:
    .ts: camelCase
  src/**/model:
    .ts: camelCase
  src/**/api:
    .ts: camelCase

ignore:
  - .git
  - node_modules
  - dist
  - coverage
  - crap-report
  - playwright-report
  - test-results
```

> **能力与局限（重要，避免误解）**
> - `ls-lint` 约束的是**命名**（目录用 `.dir`，文件用扩展名/子扩展名规则）与**声明式目录布局**（通过 glob 表达）；规则自上而下，子目录配置会**覆盖**父级。
> - **FSD 的结构与层序合法性由 `steiger` 负责**（它会校验层/切片/段是否合规、导入方向是否正确）；`ls-lint` 只补足**命名**。
> - 规则名（`kebab-case` / `camelCase` / `PascalCase` / `snake_case` / `regex:` / `exists:`）以官方文档 [ls-lint.org → The Rules](https://ls-lint.org) 为准。

## 7. 规则 → 症状 / 目标映射表

| 目标 | 落实方式 | 状态 |
|---|---|---|
| 幻影导入（AI 生成不存在模块） | `import-x/no-unresolved`（error） | **已配置**（§6.1） |
| 被吞异常 | `no-empty`（catch 空块，error） | **已配置** |
| 假完成桩 / 空实现 | `@typescript-eslint/no-empty-function`（warn）、`no-unused-vars` | **已配置** |
| 大文件（`.ts`） | `max-lines`（warn, 400） | **已配置**（§6.1） |
| 大函数 | `max-lines-per-function`（warn, 100） | **已配置**（§6.1） |
| 大组件（SFC 块过大） | `vue/max-lines-per-block`（warn, template/script 300、style 200） | **已配置**（§6.1） |
| 重复 / 复制粘贴 | `sonarjs/no-duplicate-string`（warn）；`sonarjs/no-identical-functions` | 前者**已配置**；后者**可选未配置** |
| 复杂度 | `sonarjs/cognitive-complexity`（warn, 20）；`max-statements`、`max-depth`、`max-params` | 前者**已配置**；后三者**可选未配置** |
| FSD 层序 / 跨层 / 跨切片导入 | `steiger` `fsd/forbidden-imports` 等 | **已配置**（§6.11） |
| FSD 切片公共 API / 段结构 | `steiger` `fsd/public-api`、`fsd/no-segmentless-slices` 等 | **已配置**（§6.11） |
| 循环依赖 / 孤儿模块 | `dependency-cruiser` `no-circular`、`no-orphans` | **已配置**（§6.6） |
| 目录 / 文件名不一致 | `@ls-lint/ls-lint` | **已配置**（§6.11） |
| 样式硬编码颜色 | `scale-unlimited/declaration-strict-value` + 设计 token | **已配置**（§6.2） |
| 属性顺序不一致 | `stylelint-config-recess-order`（`order/properties-order`） | **已配置** |
| Vue 3 最佳实践 | `eslint-plugin-vue` `flat/recommended` | **已配置** |
| Pinia 约定 | `eslint-plugin-pinia` `recommended-flat` | **可选未配置**（Phase 3） |
| 叙述性注释（AI 味注释） | —— | **未覆盖**（§13） |

> 「可选未配置」的规则见 §13 第 11 条；复制 §6.1 不会自动获得它们。

### SOLID 逐条覆盖（诚实说明：SOLID 是设计原则，无工具能直接检查）

| 原则 | 近似手段 |
|---|---|
| S 单一职责 | `sonarjs/cognitive-complexity`、`no-identical-functions`、`max-lines` / `max-lines-per-function` / `vue/max-lines-per-block`；FSD 切片/段划分 |
| O 开闭 | **无自动规则**（评审 + 测试） |
| L 里氏替换 | **无自动规则**（评审 + 测试） |
| I 接口隔离 | FSD 公共 API（`index.ts`）+ `steiger` `fsd/public-api`／`fsd/no-public-api-sidestep` |
| D 依赖倒置 | FSD 层序（`steiger` `fsd/forbidden-imports`）、`dependency-cruiser` 循环依赖 |

## 8. 测试与 CRAP

### 8.1 分层

- **单元**：纯函数/工具，Vitest。
- **组件**：`@vue/test-utils` 挂载 SFC，断言渲染、交互、`emits`；用 `createTestingPinia()`（`@pinia/testing`）隔离 Pinia。
- **E2E**：Playwright，Chromium/Firefox/WebKit 三浏览器；需登录页面走 `storageState` 复用。

组件测试骨架：

```ts
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, it, expect } from 'vitest'
import Comp from '@/components/Comp.vue'

describe('Comp', () => {
  it('renders and emits', async () => {
    const wrapper = mount(Comp, {
      global: { plugins: [createTestingPinia({ createSpy: () => () => {} })] },
    })
    expect(wrapper.text()).toContain('...')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('submit')).toBeTruthy()
  })
})
```

> `@pinia/testing` 的 major 必须与项目的 `pinia` major 一致（见 §4）。

### 8.2 CRAP 门禁

- **公式**：`CRAP = 复杂度² × (1 − 覆盖率)³ + 复杂度`，复杂度取 McCabe 圈复杂度。
- **输入**：`npm run test:coverage` 生成的 `coverage/lcov.info`。
- **工具**：`ts-crap`（MIT）。
- **阈值：≤ 6**（Uncle Bob 在 AI 辅助测试时代的主张，比经典 30 严格得多——意味着稍复杂的函数几乎必须被测到）。
- **命令**：`npm run crap:check`（超阈值即失败）。

### 8.3 渐进策略

仓库初始测试极少时，直接设死阈值会全线爆红。策略：

1. 复杂度先 `warn` 且阈值放宽（20），`sonarjs/no-duplicate-string` 先 `warn`；
2. **大文件/大函数/大组件阈值先 `warn`**（文件 400 / 函数 100 / SFC 块 300、style 200）；覆盖率先只出报告（不设全局阈值）；
3. 补测试 → 逐步把复杂度收到 15、把 CRAP 阈值收紧到 6 并转为硬门禁（`prepush` 改指 `verify:full:gate`）；
4. 存量超标文件收敛后，把 `max-lines` / `max-lines-per-function` / `vue/max-lines-per-block` 从 `warn` 升为 `error`。

## 9. 本地门禁流程（无 CI）

### 9.1 `pre-commit`（快速反馈）
`husky` + `lint-staged`：对暂存文件 `eslint --fix` / `stylelint --fix` / `prettier --write`。

### 9.2 `push` 之前（强门禁）
`.husky/pre-push` 调用 `npm run prepush`（= `verify:full:report`）：`format:check` + `lint` + `lint:style` + `lint:structure` + `lint:fsd` + `typecheck` + `test` + `test:coverage` + `crap:report` + `arch`。测试补齐后可改指 `verify:full:gate`（CRAP 转硬门禁）。失败即中止，符合「问题在 push 前本地处理」。

> npm 不会因 `git push` 自动触发 `prepush` 脚本，必须由 `.husky/pre-push` 显式调用（见 §6.8）。

### 9.3 E2E（不进门禁）
`npm run test:e2e` 单独运行，在发 PR 前手动执行；登录态失效用 `npm run test:e2e:auth` 重建。

### 9.4 mutation testing（不定时，非门禁）
mutation 测试迁移成本高、耗时，**不属于本门禁**，按需（如版本发布前、专项加固时）不定期执行。本文档不展开。

## 10. 接入 AI 工作流

本地开发已由 AI 驱动，因此把上述命令按「任务阶段」绑定：AI 每完成一个阶段就调用对应命令，而不是等到最后。

### 10.1 阶段 → 命令

| 阶段 | 动作 | 命令 |
|---|---|---|
| 探索 / 设计 | 只读、不改码 | 不跑门禁 |
| 实现中（改动未稳定） | 只跑**受影响**的最小检查 | 单文件 `npx eslint <file> --fix`、相关 `npx vitest run <file>`、`npm run typecheck` |
| 一个阶段/子任务完成 | 全量静态 + 测试 | `npm run verify` |
| 收尾（提交前） | 完整本地门禁 | `npm run prepush` |
| 涉及页面/交互 | 端到端 | `npm run test:e2e`（登录态失效先 `test:e2e:auth`） |
| 样式改动 | 设计一致性 | `npm run lint:style`；改了 token 先 `npm run tokens:build` |
| 新增/移动切片或目录 | FSD 结构 | `npm run lint:fsd && npm run lint:structure` |
| 不定时 | mutation | 按需，非门禁 |

### 10.2 可复制到 `AGENTS.md` 的片段

```md
## 项目结构：Feature-Sliced Design（FSD）

层只能向下依赖：app → pages → widgets → features → entities → shared；
同层不同 slice 不得互相 import；跨 slice 只能经公共 API（index.ts）。
新增/移动切片或目录后，必须跑 `npm run lint:fsd` 与 `npm run lint:structure`。

## 体积约束

单文件 ≤ 400 行、单函数 ≤ 100 行、SFC `<template>`/`<script>` ≤ 300 行、`<style>` ≤ 200 行（初始 warn）。
超限时应拆分，而不是加 eslint-disable。

## 质量门禁（本地，push 前）

本地开发由 AI 驱动，按阶段调用，不要等到最后：

- 实现中：只跑受影响的最小检查（单文件 eslint、相关 vitest、`npm run typecheck`）。
- 每个阶段/子任务完成：`npm run verify`（format:check + lint + lint:style + lint:structure + lint:fsd + typecheck + test）。
- 提交/推送前：`npm run prepush`（= `verify:full:report`，含 test:coverage、CRAP 报告、arch），失败即修复后重跑，不得绕过。
- 涉及页面的改动：发 PR 前跑 `npm run test:e2e`；登录态失效先跑 `npm run test:e2e:auth`。
- 改了设计 token：先 `npm run tokens:build` 再跑 `npm run lint:style`。
- CRAP 目标阈值 ≤ 6（测试补齐前以报告为准）；mutation 测试不定期执行，不在门禁内。
- 不得为了让门禁通过而删测试或削弱生产代码。
```

## 11. 分阶段落地

**Phase 1（基础，一次到位）**
1. 钉 Node 22 LTS（`.nvmrc` + `engines: >=22.18`）。
2. 建立 FSD 目录骨架（`app/pages/widgets/features/entities/shared`）。
3. 迁移 ESLint → 10 + flat（核心：`js` + `typescript-eslint` + `eslint-plugin-vue` + `import-x` + `sonarjs` + 大文件/大组件规则）。
4. 改写 `package.json` 脚本（`eslint .`，去掉 `--ext`）+ 加 `lint:fsd` / `lint:structure`。
5. 加 `steiger.config.ts` 与 `.ls-lint.yml`，约束 FSD 层序与目录/文件命名。
6. 样式层升到 stylelint 17 + `order` + `recess-order` + `strict-value` + `style-dictionary` token 构建。
7. 组件/单元测试跑通 + 覆盖率输出 LCOV；`prepush` 指向 `verify:full:report`（只出 CRAP 报告）。
- **验收**：`npm run prepush` 能跑通并给出 CRAP 报告（**不含**硬门禁）；`npm run lint:fsd` 通过。

**Phase 2**
开启 `tseslint.configs.recommendedTypeChecked` + `projectService`；补齐 `.vue` 的 type-aware 配置。同时把 `prepush` 改指 `verify:full:gate`，让 CRAP 转为硬门禁。
- **验收**：`npm run typecheck` 与 `npm run lint` 同时通过；`npm run prepush` 会因 CRAP 超阈值而失败。

**Phase 3**
加入 `eslint-plugin-pinia`（`recommended-flat`）；处理 `never-export-initialized-store` 等规则报警；把体积规则由 `warn` 升为 `error`。
- **验收**：`npm run lint` 无新增 error。

**贯穿**：E2E（Playwright + 登录 setup）与测试补齐可并行推进；CRAP 阈值随时间收紧到 6。

## 12. 选型与取舍（原 ADR 内容）

- **为什么结构采用 FSD**：把「层 → 切片 → 段」变成可机检的边界；层序单向、跨切片经公共 API，天然抑制循环依赖与上帝模块。
- **为什么 FSD 用 Steiger**：FSD 层序/切片规则多，手写 `dependency-cruiser` 规则维护成本高且易漏；`steiger` 是 FSD 官方产物，直接内置这些规则。`@feature-sliced/eslint-config` 已过时（ESLint 7 时代），不用。
- **为什么命名仍用 ls-lint**：Steiger 管结构与层序，命名（目录 kebab-case、组件 PascalCase）交给 `ls-lint` 更直观、极快。
- **为什么体积约束用 ESLint**：`max-lines` / `max-lines-per-function` 是 ESLint 核心规则，`vue/max-lines-per-block` 是官方 Vue 插件规则，零新增依赖、与现有 `lint` 脚本一体，无需额外工具。
- **为什么 ESLint 10 + flat**：flat config 是当前默认；`--ext` 已移除；vue/ts 插件均支持 ESLint 10。
- **为什么只用成熟工具 / 不引入不明 CLI**：`ai-slop-remover` 之类包的 CLI 接口与规则名无法核实；把 slop 症状落到确定性 ESLint 规则上，更可验证、可维护。
- **为什么放弃 UnoCSS 层**：样式层泛指 SCSS/Tailwind；本项目实际是 SCSS，故用 stylelint 而非 `@unocss/eslint-config`。
- **为什么 Prettier 与 ESLint 分离**：格式与质量解耦，ESLint 更快、报错更清晰；`eslint-config-prettier` 收尾关闭冲突。
- **为什么暂不做 CI**：本地优先；CI 是后续独立阶段。
- **为什么 CRAP 阈值 6**：采用 AI 辅助测试时代更严的主流主张，把复杂度与覆盖率绑成一个可门禁指标。
- **为什么 mutation 不进门禁**：耗时且不稳定，属不定时专项任务。

## 13. 已知未覆盖 / 待办

1. **叙述性注释**（AI 味注释）无成熟确定性规则，明确留白。
2. **SOLID 的 O / L**（开闭、里氏替换）无法自动化，只能评审 + 测试。
3. **`eslint-plugin-pinia` 维护风险**：0.4.2，2024 年后未更新、单一维护者；Phase 3 引入前再评估。
4. **`eslint-plugin-sonarjs` 为 LGPL-3.0-only**（非 MIT），商用需自行确认合规。
5. **`ts-crap` 命令行接口未验证**：其 README 示例用 `ts-anti-patterns` 作为命令，而 npm 包 bin 实为 `ts-crap`；`--lcov` / `--threshold` / `--fail-above` / `--format` / `--output` 均需以实际 `npx ts-crap --help` 为准。
6. **设计 token 的强制力有限**：`ignoreVariables: true` 只能拦硬编码颜色，拦不住非 token 变量（见 §6.2）；完全强制需自定义检查。
7. **`steiger` 与插件处于 beta**（0.x），API 可能变化；升级前看其 migration guide。
8. **体积阈值需按项目实际情况调**：400 / 100 / 300 / 200 为初始建议值；老项目存量超标文件多时，先 `warn`，收敛后再升 `error`（见 §8.3）。
9. **参考项目迁移项**（非本次执行）：**现有目录迁移到 FSD**、ESLint 8 → 10、stylelint 15 → 17、Cypress → Playwright、`yorkie` → `husky`、Pinia 2 → 4（连带 `@pinia/testing` 0.1.x → 2.x）。
10. **CRAP ≤ 6 极严**：需要配套补足测试，否则复杂函数会集中爆红。
11. **可选增强（未写入配置，按需启用）**：`import-x/no-cycle` → error；`sonarjs/no-identical-functions`、`max-statements`、`max-depth`、`max-params`、`vue/max-props`、`vue/max-template-depth` 落入配置；`commitlint`、`npm audit`、可访问性测试（axe）、视觉回归、性能预算。
12. **CI 门禁**：属后续独立阶段。
