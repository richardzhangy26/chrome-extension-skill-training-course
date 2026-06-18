# 项目配置规则报告

## 📋 概览

本项目是一个基于 **Turborepo + pnpm Workspace** 的 Chrome 扩展 monorepo，采用 **TypeScript + React 19 + Vite 6** 技术栈。

---

## 🏗️ Turborepo & Workspace 配置

### pnpm Workspace 结构 (`pnpm-workspace.yaml`)

```yaml
packages:
  - chrome-extension          # 扩展主体
  - pages/*                   # 扩展页面（popup, side-panel, options 等）
  - packages/*                # 共享库（storage, shared, ui 等）
  - tests/*                   # 测试套件
```

**关键规则：**
- ✅ 使用 `@extension/*` 命名空间导入共享包（如 `@extension/shared`, `@extension/storage`）
- ❌ **禁止**使用相对路径跨越 workspace 边界（如 `../../packages/shared`）
- 仅内置依赖被标记为 `onlyBuiltDependencies`（@parcel/watcher, @swc/core, esbuild 等）

### Turborepo 任务编排 (`turbo.json`)

| 任务 | 依赖关系 | 缓存 | 说明 |
|------|---------|------|------|
| `ready` | `^ready` | ❌ | 准备阶段，输出到 `dist/` |
| `dev` | `ready` | ❌ | 开发模式（持久化），支持 HMR |
| `build` | `ready`, `^build` | ❌ | 生产构建 |
| `type-check` | - | ❌ | TypeScript 类型检查 |
| `lint` | - | ❌ | ESLint 检查 |
| `lint:fix` | - | ❌ | 自动修复 ESLint 问题 |
| `format` | `^format` | ❌ | Prettier 格式化 |
| `e2e` | - | ❌ | 端到端测试 |

**全局环境变量：**
- `CEB_*` 和 `CLI_CEB_*` 前缀的变量被视为全局依赖
- `.env` 文件被视为全局依赖（任何变更触发全量重建）
- 并发度：12

**关键规则：**
- ✅ 所有任务输出到 `dist/` 目录
- ✅ `dev` 任务标记为 `persistent: true`（长期运行）
- ❌ 缓存全部禁用（`cache: false`）以确保一致性

---

## 🔧 TypeScript 配置

### 根 tsconfig.json

```json
{
  "extends": "./packages/tsconfig/base.json",
  "compilerOptions": {
    "noImplicitAny": false,
    "noEmit": false,
    "target": "ESNext"
  },
  "include": ["eslint.config.ts"]
}
```

### 基础配置 (`packages/tsconfig/base.json`)

| 选项 | 值 | 说明 |
|------|-----|------|
| `target` | `ESNext` | 最新 JavaScript 特性 |
| `module` | `ESNext` | ESM 模块系统 |
| `moduleResolution` | `bundler` | Vite/Webpack 风格解析 |
| `jsx` | `react-jsx` | React 17+ 自动导入 JSX |
| `strict` | `true` | 严格类型检查 |
| `noImplicitAny` | `true` | 禁止隐式 any |
| `skipLibCheck` | `true` | 跳过 .d.ts 检查（加速） |
| `allowSyntheticDefaultImports` | `true` | 允许 `import X from 'cjs'` |
| `esModuleInterop` | `true` | CommonJS 互操作 |
| `resolveJsonModule` | `true` | 导入 JSON 文件 |
| `lib` | `["DOM", "ESNext"]` | DOM + 最新 JS API |
| `types` | `["node", "chrome"]` | Node.js + Chrome API 类型 |

**关键规则：**
- ✅ 所有 workspace 包继承此基础配置
- ✅ 支持 Chrome API 类型（`@types/chrome`）
- ✅ 严格模式强制执行

---

## 📝 ESLint 配置 (`eslint.config.ts`)

### 启用的规则集

| 规则集 | 来源 | 说明 |
|--------|------|------|
| `js.configs.recommended` | @eslint/js | JavaScript 推荐规则 |
| `tsConfigs.recommended` | typescript-eslint | TypeScript 推荐规则 |
| `jsxA11y.flatConfigs.recommended` | eslint-plugin-jsx-a11y | 无障碍访问规则 |
| `importXFlatConfig.recommended` | eslint-plugin-import-x | 导入规则 |
| `importXFlatConfig.typescript` | eslint-plugin-import-x | TypeScript 导入规则 |
| `eslintPluginPrettierRecommended` | eslint-plugin-prettier | Prettier 集成 |
| `react-hooks/recommended` | eslint-plugin-react-hooks | React Hooks 规则 |
| `reactPlugin.configs.flat.recommended` | eslint-plugin-react | React 推荐规则 |
| `reactPlugin.configs.flat['jsx-runtime']` | eslint-plugin-react | React 17+ JSX 自动导入 |

### 严格规则（必须遵守）

#### 1️⃣ 函数风格 (`func-style`)
```typescript
// ❌ 错误：函数声明
function MyComponent() { ... }

// ✅ 正确：箭头函数表达式
const MyComponent = () => { ... };
```

#### 2️⃣ 导出位置 (`import-x/exports-last`)
```typescript
// ❌ 错误：导出在中间
export const foo = 1;
const bar = 2;

// ✅ 正确：导出在末尾
const foo = 1;
const bar = 2;
export { foo };
```

#### 3️⃣ 导入顺序 (`import-x/order`)
```typescript
// 顺序：builtin → external → internal (@*/**) → parent → sibling → index → type
import fs from 'fs';                    // builtin
import React from 'react';              // external
import { shared } from '@extension/shared'; // internal
import { parent } from '../parent';     // parent
import { sibling } from './sibling';    // sibling
import type { Type } from './types';    // type
```

**配置细节：**
- 无换行符分隔（`newlines-between: 'never'`）
- 字母顺序排序（不区分大小写）
- `@*/**` 模式被视为 `internal` 组

#### 4️⃣ 无障碍访问 (`jsx-a11y/*`)
```tsx
// ❌ 错误：可点击元素缺少键盘支持
<div onClick={handleClick}>Click me</div>

// ✅ 正确：完整的无障碍属性
<div
  onClick={handleClick}
  onKeyDown={e => e.key === 'Enter' && handleClick()}
  role="button"
  tabIndex={0}
  aria-label="Description"
/>
```

**表单标签规则：**
```tsx
// ❌ 错误：标签未关联
<label>Email</label>
<input type="email" />

// ✅ 正确：通过 htmlFor 和 id 关联
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

#### 5️⃣ 未使用变量 (`@typescript-eslint/no-unused-vars`)
```typescript
// ❌ 错误：捕获但未使用的异常
} catch (e) { console.log('error'); }

// ✅ 正确：省略未使用的参数
} catch { console.log('error'); }
```

#### 6️⃣ 类型导入 (`@typescript-eslint/consistent-type-imports`)
```typescript
// ❌ 错误：混合导入
import { Component, type Props } from 'react';

// ✅ 正确：分离类型导入
import type { Props } from 'react';
import { Component } from 'react';
```

#### 7️⃣ 箭头函数体 (`arrow-body-style`)
```typescript
// ❌ 错误：不必要的花括号
const double = (x) => { return x * 2; };

// ✅ 正确：隐式返回
const double = (x) => x * 2;
```

#### 8️⃣ 导入限制 (`no-restricted-imports`)
```typescript
// ❌ 错误：直接导入 type-fest
import { Prettify } from 'type-fest';

// ✅ 正确：从 @extension/shared 导入
import { Prettify } from '@extension/shared';
```

### 忽略规则

```typescript
ignores: [
  '**/build/**',
  '**/dist/**',
  '**/node_modules/**',
  'chrome-extension/manifest.js'  // 自动生成的 manifest
]
```

### 特殊覆盖

**`packages/shared/**/*.ts`：**
- 禁用 `no-restricted-imports`（允许直接导入 type-fest）

---

## 🔨 Vite 配置

### 页面级 Vite 配置示例 (`pages/side-panel/vite.config.mts`)

```typescript
import { withPageConfig } from '@extension/vite-config';

export default withPageConfig({
  resolve: {
    alias: {
      '@src': srcDir,  // 页面内部别名
    },
  },
  publicDir: resolve(rootDir, 'public'),
  build: {
    outDir: resolve(rootDir, '..', '..', 'dist', 'side-panel'),
  },
});
```

**关键规则：**
- ✅ 所有页面使用 `withPageConfig` 包装器（来自 `@extension/vite-config`）
- ✅ 输出目录统一到 `dist/<page-name>/`
- ✅ 支持 `@src` 别名指向页面内部 `src/` 目录
- ✅ 每个页面有独立的 `public/` 目录

---

## 📦 依赖管理

### 全局依赖安装
```bash
pnpm i <package> -w
```

### 工作区特定依赖
```bash
pnpm i <package> -F side-panel
pnpm i <package> -F @extension/shared
```

### 内置依赖（仅构建时）
```
@parcel/watcher, @swc/core, esbuild, geckodriver, edgedriver, unrs-resolver
```

---

## 🚀 构建命令

### 开发
```bash
pnpm dev              # Chrome 开发模式（HMR）
pnpm dev:firefox      # Firefox 开发模式
```

### 生产
```bash
pnpm build            # Chrome 生产构建
pnpm build:firefox    # Firefox 生产构建
pnpm zip              # 打包为 ZIP（Chrome）
pnpm zip:firefox      # 打包为 ZIP（Firefox）
```

### 代码质量
```bash
pnpm type-check       # TypeScript 检查
pnpm lint             # ESLint 检查
pnpm lint:fix         # 自动修复
pnpm format           # Prettier 格式化
```

### 清理
```bash
pnpm clean            # 清理 dist + node_modules + .turbo
pnpm clean:install    # 深度清理后重新安装
```

---

## 🎯 关键约定总结

| 类别 | 规则 |
|------|------|
| **导入路径** | 使用 `@extension/*` 命名空间，禁止相对路径跨越 workspace |
| **函数声明** | 仅使用箭头函数表达式 |
| **导出位置** | 所有导出必须在文件末尾 |
| **导入顺序** | builtin → external → internal → parent → sibling → index → type |
| **类型导入** | 分离 `import type` 和 `import` |
| **无障碍访问** | 可点击元素需要 `role`, `tabIndex`, `onKeyDown`, `aria-label` |
| **Manifest** | 编辑 `chrome-extension/manifest.ts`，不要直接改 `manifest.json` |
| **模块删除** | 使用 `pnpm module-manager -d <feature>` 安全删除 |
| **缓存策略** | Turborepo 缓存全部禁用，确保一致性 |
| **环境变量** | `CEB_*` 和 `CLI_CEB_*` 前缀被视为全局依赖 |

---

## 📊 项目结构

```
├── chrome-extension/          # 扩展主体
│   ├── manifest.ts            # ⚠️ 编辑这里，不要改 manifest.json
│   ├── src/background/        # 后台服务脚本
│   └── public/                # 静态资源
│
├── pages/                     # 扩展页面（独立入口）
│   ├── side-panel/            # 主聊天界面
│   ├── popup/                 # 工具栏弹窗
│   ├── options/               # 设置页面
│   ├── new-tab/               # 新标签页
│   ├── devtools/              # 开发者工具
│   ├── devtools-panel/        # 开发者工具面板
│   ├── content/               # 注入脚本
│   ├── content-ui/            # 注入 React 组件
│   └── content-runtime/       # 注入运行时
│
├── packages/                  # 共享库
│   ├── shared/                # 类型、常量、工具函数
│   ├── storage/               # Chrome 存储封装
│   ├── ui/                    # 可复用 React 组件
│   ├── i18n/                  # 国际化
│   ├── vite-config/           # Vite 配置工具
│   ├── tailwindcss-config/    # Tailwind 配置
│   ├── hmr/                   # HMR 工具
│   ├── dev-utils/             # 开发工具
│   ├── module-manager/        # 模块管理 CLI
│   ├── env/                   # 环境变量
│   ├── zipper/                # ZIP 打包工具
│   └── tsconfig/              # TypeScript 配置
│
└── tests/                     # 测试套件
    └── e2e/                   # WebdriverIO 端到端测试
```

---

## ⚠️ 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `Cannot find module '@extension/...'` | 使用相对路径跨越 workspace | 改用 `@extension/*` 导入 |
| `ESLint: func-style` | 使用函数声明 | 改为箭头函数表达式 |
| `ESLint: exports-last` | 导出不在文件末尾 | 移动所有导出到末尾 |
| `ESLint: jsx-a11y` | 可点击元素缺少无障碍属性 | 添加 `role`, `tabIndex`, `onKeyDown` |
| `manifest.json 改动无效` | 直接编辑 manifest.json | 编辑 `chrome-extension/manifest.ts` |
| `HMR 卡住` | Turbo 进程冲突 | `Ctrl+C` 后重新运行 `pnpm dev` |

---

## 🔗 相关文档

- [Turborepo 官方文档](https://turbo.build/repo/docs)
- [pnpm Workspace 文档](https://pnpm.io/workspaces)
- [TypeScript 编译器选项](https://www.typescriptlang.org/tsconfig)
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files-new)
- [Vite 官方文档](https://vitejs.dev/)
- [Chrome Extensions MV3](https://developer.chrome.com/docs/extensions)

---

**最后更新：** 2026-05-22  
**项目版本：** v0.8.0  
**Node.js 要求：** >= 22.15.1  
**pnpm 要求：** >= 10.11.0
