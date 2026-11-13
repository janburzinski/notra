import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

import { buildSecurityHeaders } from "./src/utils/security-headers";

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  server: { port: 3006 },
  plugins: [
    tailwindcss(),
    tanstackStart(),
    react(),
    nitro({
      compressPublicAssets:
        process.env.VERCEL === "1" ? false : { gzip: true, brotli: true },
      routeRules: {
        "/**": { headers: buildSecurityHeaders(command === "serve") },
      },
    }),
  ],
}));
