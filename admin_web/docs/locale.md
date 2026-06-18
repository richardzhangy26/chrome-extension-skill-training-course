# Locale

This project uses Paraglide JS for runtime locale support.

## Locales

- Base locale: `en`
- Additional locale: `zh`
- Default English URLs are unprefixed: `/about`
- Chinese URLs use a prefix: `/zh/about`

## Files

- Source messages: `project.inlang/messages/en.json` and `zh.json`
- Paraglide settings: `project.inlang/settings.json`
- Generated runtime: `src/locale/paraglide/`
- Project locale helpers: `src/lib/locale.ts`
- Server middleware wrapper: `src/locale/middleware.ts`

Markdown content stays in the same collection directory. English content uses
the base filename, while localized variants add the locale before `.md`:

```txt
content/blog/getting-started.md
content/blog/getting-started.zh.md
content/changelog/v1.0.0.md
content/changelog/v1.0.0.zh.md
content/pages/privacy.md
content/pages/privacy.zh.md
```

`content-collections.ts` strips the `.zh` suffix from the route slug, so
`getting-started.md` and `getting-started.zh.md` both map to `/blog/getting-started`
under their respective URL locale.

`src/locale/paraglide/` is generated code and is ignored by git.

## Commands

```bash
pnpm locale:sort      # sort message keys by prefix/name in all locale JSON files
pnpm locale:check     # verify en/zh key parity and JSON leaf values
pnpm locale:compile   # compile Paraglide runtime manually
```

`pnpm dev` and `pnpm build` also compile the Paraglide runtime via Vite.

## Message Access

Application code reads messages directly from the generated Paraglide module:

```ts
import { m } from '@/locale/paraglide/messages';

m.auth_login_email();
```

`project.inlang/messages/*.json` is the single source of UI and email message
truth. Do not add parallel TS message source files or nested compatibility
layers.

When a server-side workflow must always render in English, pass an explicit
locale option:

```ts
m.mail_verify_email_subject(undefined, { locale: 'en' });
```

Small arrays and record-like values, such as pricing feature lists, are stored
as JSON strings in Paraglide messages and parsed through `parseMessageJson()`
in `src/lib/locale.ts`.

Structured UI content, such as Homepage, AI Playground, and Roadmap copy, still
uses individual message keys in `project.inlang/messages/*.json`. Do not store a
whole page or block tree as one JSON-string message. Components should call the
generated flat `m.key()` functions directly. If a component needs a list, define
that list in the component and use `m.key()` for the translatable fields.

## Adding Copy

- Short UI copy: add the same key to `project.inlang/messages/en.json` and
  `project.inlang/messages/zh.json`, run `pnpm locale:sort`, then call the
  generated `m.key()`.
- Email copy: add the key to the JSON files and read it through
  `m.key(undefined, { locale: 'en' })`.
- Homepage, AI, or Roadmap structured copy: add or update individual message
  keys in the JSON files, then call the generated `m.key()` functions directly
  from the component.
- Long-form content: add Markdown files, for example `post.md` and
  `post.zh.md`.

## Current Scope

The current implementation supports:

- Runtime UI messages through `@/locale/paraglide/messages`
- Homepage blocks through direct `m.key()` calls
- AI Playground UI through direct `m.key()` calls
- Roadmap board content through direct `m.key()` calls
- Blog Markdown content with locale-aware content collections
- Changelog Markdown content with locale-aware content collections
- Legal Markdown pages with locale-aware content collections
- Locale-aware canonical, hreflang, and sitemap output

The current implementation intentionally does not handle:

- User profile locale storage
- Email locale
