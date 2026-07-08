import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";

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
  markdown: {
    rehypePlugins: [rehypeWrapTables],
  },

  // Required for absolute URLs in canonical/Open Graph tags (and sitemaps).
  site: "https://streanga.com",

  server: {
    host: true, // bind to 0.0.0.0 so the host can reach the dev server in a container
    port: 4321,
    strictPort: true, // fail loudly instead of drifting to 4322
  },

  vite: {
    server: {
      watch: {
        usePolling: true, // reliable hot reload across a container bind mount
      },
    },
  },

  integrations: [mdx()],
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Inter",
      cssVariable: "--font-inter",
      weights: ["100 900"], // variable range
    },
    {
      provider: fontProviders.fontsource(),
      name: "Fraunces",
      cssVariable: "--font-fraunces",
      weights: ["100 900"],
      styles: ["normal", "italic"],
    },
  ],
});
