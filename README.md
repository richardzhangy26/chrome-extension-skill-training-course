# Polymas AI 训练助手 - Chrome 扩展

基于 React 19 + TypeScript + Vite 6 构建的浏览器扩展，用于 Polymas 教学平台的 AI 能力训练。

## 目录

- [安装使用](#安装使用)
- [分享给他人](#分享给他人)
- [开发指南](#开发指南)
- [项目结构](#项目结构)
- [常见问题](#常见问题)

---

## 安装使用

### 支持的浏览器

| 浏览器 | 支持情况 | 说明 |
|--------|---------|------|
| Chrome | ✅ 完全支持 | 推荐使用 |
| Edge | ✅ 兼容 | 基于 Chromium |
| Brave | ✅ 兼容 | 基于 Chromium |
| Firefox | ✅ 支持 | 需单独构建 |

### Chrome / Edge / Brave 安装步骤

1. 获取扩展文件（ZIP 包或文件夹）
2. 解压 ZIP 文件（如果是压缩包）
3. 打开浏览器扩展页面：
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
4. 开启右上角的 **开发者模式**
5. 点击 **加载已解压的扩展程序**
6. 选择解压后的文件夹

### Firefox 安装步骤

1. 获取 Firefox 版本的扩展文件
2. 打开 `about:debugging#/runtime/this-firefox`
3. 点击 **临时载入附加组件**
4. 选择文件夹中的 `manifest.json`

> ⚠️ **注意**：Firefox 临时加载的扩展会在浏览器关闭后消失，需要每次启动浏览器时重新加载。

---

## 分享给他人

### 方式一：发送 ZIP 包（适合小范围分享）

开发者打包：
```bash
# Chrome / Edge / Brave 版本
pnpm zip

# Firefox 版本
pnpm zip:firefox
```

打包后的文件在 `dist-zip/` 目录下，发送给需要的人即可。

接收者按照上面的 [安装使用](#安装使用) 步骤安装。

### 方式二：发布到应用商店（适合公开分发）

| 商店 | 地址 | 费用 |
|------|------|------|
| Chrome Web Store | https://chrome.google.com/webstore/devconsole | $5 一次性 |
| Firefox Add-ons | https://addons.mozilla.org/developers/ | 免费 |
| Edge Add-ons | https://partner.microsoft.com/dashboard | 免费 |

---

## 开发指南

### 环境要求

- **Node.js**: >= 22.15.1（查看 `.nvmrc`）
- **包管理器**: pnpm 10.11.0+
- **Windows 用户**: 必须在 WSL 环境下运行

### 安装依赖

```bash
# 全局安装 pnpm（如果没有）
npm install -g pnpm

# 安装项目依赖
pnpm install
```

### 开发命令

```bash
# 启动开发服务器（支持热更新）
pnpm dev              # Chrome 版本
pnpm dev:firefox      # Firefox 版本

# 生产构建
pnpm build            # Chrome 版本
pnpm build:firefox    # Firefox 版本

# 打包 ZIP
pnpm zip              # Chrome 版本
pnpm zip:firefox      # Firefox 版本
```

### 代码检查

```bash
pnpm type-check       # TypeScript 类型检查
pnpm lint             # ESLint 检查
pnpm lint:fix         # 自动修复 ESLint 问题
pnpm format           # Prettier 格式化
```

### 添加依赖

```bash
# 在根目录添加依赖
pnpm i <package> -w

# 为特定模块添加依赖（如 side-panel）
pnpm i <package> -F side-panel
```

### 清理项目

```bash
pnpm clean            # 清理 dist、node_modules、turbo 缓存
pnpm clean:install    # 清理后重新安装
```

---

## 项目结构

```
├── chrome-extension/     # 扩展配置
│   ├── manifest.ts       # 生成 manifest.json（修改这里，不要直接改 manifest.json）
│   ├── src/background/   # 后台服务脚本
│   └── public/           # 图标等静态资源
│
├── pages/                # 扩展页面（每个是独立入口）
│   ├── side-panel/       # 侧边栏（主要聊天界面）
│   ├── popup/            # 工具栏弹窗
│   ├── options/          # 设置页面
│   ├── content/          # 注入页面的脚本
│   └── content-ui/       # 注入页面的 React 组件
│
└── packages/             # 共享库
    ├── storage/          # Chrome 存储封装
    ├── shared/           # 共享类型、常量、工具函数
    ├── ui/               # 可复用 React 组件
    └── i18n/             # 国际化
```

### 关键文件说明

| 文件/目录 | 说明 |
|-----------|------|
| `chrome-extension/manifest.ts` | 扩展清单配置，**不要直接编辑 manifest.json** |
| `pages/side-panel/` | 主要的 AI 聊天界面 |
| `chrome-extension/src/background/` | 后台服务，处理认证和 API 请求 |
| `packages/storage/lib/impl/` | 存储模块，新模块需在 `index.ts` 中导出 |

---

## 常见问题

### 热更新卡住了

1. 按 `Ctrl+C` 停止开发服务器，然后重新运行 `pnpm dev`
2. 如果遇到 `grpc` 错误，先杀掉 `turbo` 进程再重新运行

### 导入路径报错

使用 `@extension/` 前缀导入共享包，例如：
```typescript
import { someUtil } from '@extension/shared';
import { storage } from '@extension/storage';
```

### Windows 下运行失败

必须在 WSL 环境下运行，并且 `pnpm dev` 需要以管理员身份运行。

### 调试方法

| 组件 | 调试方式 |
|------|----------|
| 侧边栏 | 右键侧边栏 → 检查 |
| 后台脚本 | `chrome://extensions` → 点击扩展的 "service worker" |
| 内容脚本 | 打开页面的开发者工具 → 控制台 |
| 弹窗 | 右键扩展图标 → 检查弹出内容 |

---

## 版本更新

```bash
pnpm update-version <version>    # 更新扩展版本号
```

---

## 参考资料

- [Chrome Extensions 文档](https://developer.chrome.com/docs/extensions)
- [Vite 文档](https://vitejs.dev/)
- [Turborepo 文档](https://turbo.build/repo/docs)
