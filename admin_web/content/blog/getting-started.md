---
title: Getting Started
description: Quick guide to set up and run the TanStarter template.
date: 2026-02-12
category: Guide
image: https://cdn.mksaas.com/tanstarter/template/blog-get-started.jpeg
---

This post walks you through the basics of running and customizing the TanStarter template.

## Prerequisites

1. Node.js 18+
2. pnpm (or npm / yarn)

## Steps

Install dependencies and run the dev server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

![img](https://cdn.mksaas.com/tanstarter/template/blog-get-started.jpeg)

Blog posts live in `content/blog/` as Markdown files. The collection is defined in `content-collections.ts` with fields: `title`, `description`, `date`, `category`, `content`, and `image`. The slug is derived from the file path (e.g. `getting-started.md` → `getting-started`).

## Next steps

- Toggle the blog and set pagination in `src/config/website.ts` under `blog.enable` and `blog.paginationSize`.
- Add more posts under `content/blog/`; they will show up on the blog list and in the route `/blog/$slug`.
- Customize the layout and blocks in `src/components/blocks/` and `src/routes/` as needed.
