---
title: Hello World
description: A simple introduction to the blog and what you can expect.
date: 2026-02-11
category: General
image: https://cdn.mksaas.com/tanstarter/template/blog-hello-world.jpeg
---

This is the first post on the blog. You can use **Markdown** here.

## Paragraphs and headings

Normal paragraphs are supported. So are lists:

- Item one
- Item two
- Item three

The blog is powered by **content-collections**: each post is a Markdown file under `content/blog/` with frontmatter for `title`, `description`, `date`, `category`, and `image`. The template uses `@tailwindcss/typography` for readable prose and applies a dedicated heading font (Bricolage Grotesque) in `src/styles.css`.

## Images and links

You can add [links](https://example.com) and reference images. Keep the layout simple and readable.

![img](https://cdn.mksaas.com/tanstarter/template/blog-hello-world.jpeg)

## Code

Inline `code` and blocks are supported. Code blocks use the mono font (Noto Sans Mono) and get a muted background in dark mode. No syntax highlighting by design in this minimal setup.

```bash
pnpm dev
```

Thanks for reading.
