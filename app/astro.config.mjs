import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkLunaFences from "./src/lib/remark-luna-fences.mjs";
import cspHeaders from "./csp-headers.mjs";

// Wrap every GFM table in <div class="table-wrap"> so wide tables can scroll on
// narrow screens and take the same card frame as code blocks (see PostLayout).
function rehypeWrapTables() {
  return (tree) => {
    const walk = (node) => {
      if (!node.children) return;
      node.children.forEach((child, i) => {
        if (child.type === "element" && child.tagName === "table") {
          node.children[i] = {
            type: "element",
            tagName: "div",
            properties: { className: ["table-wrap"] },
            children: [child],
          };
        } else {
          walk(child);
        }
      });
    };
    walk(tree);
  };
}

export default defineConfig({
  // Applies to .md and .mdx (MDX inherits markdown config by default).
  // Astro 7's default processor is Sätteri; our remark/rehype plugins run on the
  // legacy `unified` processor, so we select it explicitly. (The deprecated
  // markdown.remarkPlugins/rehypePlugins fields forced this same processor
  // implicitly — this is behavior-preserving, just without the deprecation warning.)
  markdown: {
    processor: unified({
      // Rewrite ```luna fences into <LunaCode> before Shiki runs (see the plugin).
      // The slug page must pass components={{ LunaCode }} to <Content /> for it.
      remarkPlugins: [remarkLunaFences],
      rehypePlugins: [rehypeWrapTables],
    }),
  },

  // Required for absolute URLs in canonical/Open Graph tags (and sitemaps).
  site: "https://streanga.com",

  server: {
    host: true, // bind to 0.0.0.0 so the host can reach the dev server in a container
    port: 4321,
    strictPort: true, // fail loudly instead of drifting to 4322
  },

  // Inline all CSS into each page so it's present at first paint — no external,
  // render-blocking stylesheet that a cold load would paint ahead of, causing a
  // flash of unstyled content (and blur-up placeholder tiling) before it lands.
  build: {
    inlineStylesheets: "always",
  },

  vite: {
    server: {
      watch: {
        usePolling: true, // reliable hot reload across a container bind mount
      },
    },
    // Keep bundled component scripts EXTERNAL. Reason (load-bearing, do NOT
    // remove): Astro's view-transition router re-runs external module scripts by
    // their src URL, but re-runs INLINE module scripts by injecting a
    // `data:application/javascript` script — which the CSP blocks (allowing
    // `data:` in script-src would be an XSS hole). Externalizing also lets
    // `script-src 'self'` cover them, so the CSP needs only the two is:inline
    // hashes. (CSS is inlined separately via build.inlineStylesheets above.)
    build: {
      assetsInlineLimit: 0,
    },
  },

  integrations: [
    mdx(),
    // Keep the form thank-you page out of search results.
    sitemap({ filter: (page) => !page.includes("/contact/thanks") }),
    // Generates dist/_headers (CSP + security headers) with inline-script
    // hashes computed from the built HTML. See csp-headers.mjs.
    cspHeaders(),
  ],
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["100 900"], // variable range
      // optional (not swap): with the font preloaded it renders from first paint,
      // and otherwise sticks with the fallback for that load rather than swapping
      // mid-page — so no font-driven reflow (e.g. the email link).
      display: "optional",
    },
    {
      provider: fontProviders.fontsource(),
      name: "Literata",
      cssVariable: "--font-literata",
      weights: ["200 900"],
      styles: ["normal", "italic"],
      display: "optional",
    },
  ],
});
