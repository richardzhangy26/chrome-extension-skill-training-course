---
title: 部署到生产环境
description: 如何将应用构建并部署到 Cloudflare Workers。
date: 2026-02-13
category: 指南
image: https://cdn.mksaas.com/tanstarter/template/blog-deployment.jpeg
---

当应用准备就绪后，你可以用一条命令完成部署。

## 构建

创建优化后的生产构建：

```bash
pnpm build
```

默认输出目录是 `dist/`。对于 Cloudflare，Worker 入口和静态资源分别位于 `dist/server/` 和 `dist/client/`。构建流程使用 Cloudflare Vite 插件，因此产物可以直接用于 Workers。

## 部署到 Cloudflare

如果使用模板内置的 Wrangler 配置：

```bash
pnpm deploy
```

这会先运行 `pnpm build`，然后执行 `wrangler deploy`。请在 `wrangler.jsonc` 中配置你的账号和绑定，并用 `wrangler secret` 设置所需环境变量或密钥。

![img](https://cdn.mksaas.com/tanstarter/template/blog-deployment.jpeg)

祝你顺利发布。
