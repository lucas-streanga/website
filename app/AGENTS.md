## Runtime environment

Both the website and you (Claude) run inside a **Podman container**. Practical consequences:

- The source at `/website/app` is bind-mounted from the host repo (`./app`), so edits here persist to the host and survive `--rm`. It runs rootless with `userns_mode: "keep-id"`, mapping the container's `node` user to the host user — that's what makes these files writable from inside.
- The dev server must bind to `0.0.0.0` so the host can reach it — already set via `server.host: true` in `astro.config.mjs`. Don't change it to `localhost`.
- Hot reload relies on filesystem polling (`vite.server.watch.usePolling: true`) because native inotify events don't cross the bind mount reliably. Leave it on.
- The port is fixed at `4321` with `strictPort: true`, so the server fails loudly rather than drifting to another port. Don't assume a different port is in use.
- `node_modules` is a named volume mounted on top of the source, not the host's copy.
- **Handing images to Claude:** clipboard paste doesn't work (the container has no access to the host's Wayland clipboard, by design). Instead, drop the image on the host into `app/scratch/` (gitignored) and reference it by path, e.g. `scratch/shot.png` — Claude reads image files directly.

## Project structure

This is an Astro site (content-driven personal site + blog) rooted at `app/`. Key locations:

```
app/
├── astro.config.mjs        # Site config: domain, container-friendly server, fonts, MDX integration
├── sync-luna-grammar.mjs   # Prebuild/predev step that syncs the Luna syntax grammar (see package.json scripts)
├── src/
│   ├── content/
│   │   └── blog/           # Blog posts as .md/.mdx, plus their co-located cover images/assets
│   ├── content.config.ts   # The `blog` collection schema (title, date, description, tags, cover, …) — edit here to add frontmatter fields
│   ├── pages/              # File-based routes
│   │   ├── index.astro         # Home page
│   │   ├── 404.astro
│   │   └── blog/
│   │       ├── index.astro     # /blog post index (cards, newest first)
│   │       └── [...slug].astro # Generates one page per blog entry via getStaticPaths
│   ├── layouts/
│   │   ├── BaseLayout.astro     # Shared HTML shell: head/SEO, navbar, global styles
│   │   └── PostLayout.astro     # Per-post wrapper: cover, title, date, tags, article body
│   ├── components/          # Reusable .astro components
│   │   ├── Navbar.astro, ThemeToggle.astro
│   │   ├── Link.astro, BlurImage.astro   # BlurImage = optimized image w/ blur-up via sharp
│   │   └── LunaCode.astro                # Renders Luna source with Shiki highlighting
│   ├── lib/                 # Non-component TypeScript helpers
│   │   ├── inlineMarkdown.ts  # Minimal inline-Markdown renderer for short strings (e.g. captions)
│   │   └── shiki-luna.ts      # Luna grammar registration for Shiki code highlighting
│   ├── styles/global.css    # Design tokens (colors/spacing) + global styles; theming lives here
│   └── assets/              # Images and code snippets imported by pages/components
└── public/                 # Static files served as-is at the site root
```

Where to make common changes:

- **New blog post** → add a `.md`/`.mdx` file under `src/content/blog/` matching the schema in `content.config.ts`; it's auto-routed via `[...slug].astro`.
- **New frontmatter field** → edit the `blog` schema in `src/content.config.ts` (type-checked everywhere).
- **New page/route** → add a file under `src/pages/`.
- **Styling / theme tokens** → `src/styles/global.css`.
- **Shared markup (nav, SEO head)** → `src/layouts/`.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
