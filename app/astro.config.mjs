import { defineConfig } from "astro/config";

export default defineConfig({
  // Required for absolute URLs in canonical/Open Graph tags (and sitemaps).
  site: "https://streanga.com",

  server: {
    host: true, // bind to 0.0.0.0 so the host can reach the dev server in a container
  },
  vite: {
    server: {
      watch: {
        usePolling: true, // reliable hot reload across a container bind mount
      },
    },
  },
});
