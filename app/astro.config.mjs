// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  server: {
    host: true, // bind to 0.0.0.0 so the host can connect
  },
});
