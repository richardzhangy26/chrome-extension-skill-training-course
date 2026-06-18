---
title: 快速开始
description: 设置并运行 TanStarter 模板的快速指南。
date: 2026-02-12
category: 指南
image: https://cdn.mksaas.com/tanstarter/template/blog-get-started.jpeg
---

这篇文章会带你了解如何运行和定制 TanStarter 模板。

## 前置条件

1. Node.js 18+
2. pnpm（也可以使用 npm / yarn）

## 步骤

安装依赖并启动开发服务器：

```bash
pnpm install
pnpm dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

![img](https://cdn.mksaas.com/tanstarter/template/blog-get-started.jpeg)

博客文章以 Markdown 文件形式存放在 `content/blog/`。集合定义在 `content-collections.ts`，字段包括 `title`、`description`、`date`、`category`、`content` 和 `image`。slug 会从文件路径派生，例如 `getting-started.md` 会变成 `getting-started`。

## 下一步

- 在 `src/config/website.ts` 的 `blog.enable` 和 `blog.paginationSize` 中开关博客并设置分页数量。
- 在 `content/blog/` 下添加更多文章，它们会自动出现在博客列表和 `/blog/$slug` 路由中。
- 按需定制 `src/components/blocks/` 和 `src/routes/` 中的页面布局与区块。
