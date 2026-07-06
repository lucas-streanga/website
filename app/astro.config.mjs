import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";

export default defineConfig({
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
