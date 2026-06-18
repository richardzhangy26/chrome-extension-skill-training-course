---
title: Hello World
description: 博客的简单介绍，以及你可以在这里发布什么内容。
date: 2026-02-11
category: 通用
image: https://cdn.mksaas.com/tanstarter/template/blog-hello-world.jpeg
---

这是博客的第一篇文章。你可以在这里使用 **Markdown** 编写内容。

## 段落和标题

普通段落可以直接书写，也支持列表：

- 第一项
- 第二项
- 第三项

博客由 **content-collections** 驱动：每篇文章都是 `content/blog/` 下的 Markdown 文件，并通过 frontmatter 定义 `title`、`description`、`date`、`category` 和 `image`。模板使用 `@tailwindcss/typography` 提供易读的正文排版，并在 `src/styles.css` 中为标题应用专用字体 Bricolage Grotesque。

## 图片和链接

你可以添加 [链接](https://example.com)，也可以引用图片。建议保持布局简单清晰，便于阅读。

![img](https://cdn.mksaas.com/tanstarter/template/blog-hello-world.jpeg)

## 代码

支持行内 `code` 和代码块。代码块使用等宽字体 Noto Sans Mono，并在深色模式下显示柔和背景。这个最小化模板默认不启用语法高亮。

```bash
pnpm dev
```

感谢阅读。
