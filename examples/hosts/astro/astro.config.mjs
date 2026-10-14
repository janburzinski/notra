import node from "@astrojs/node";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:4321",
  adapter: node({ mode: "standalone" }),
  trailingSlash: "ignore",
  security: {
    checkOrigin: false,
  },
});
