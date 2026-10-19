import { readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const paramsPath = process.env.NOTRA_BUILD_PARAMS;
if (!paramsPath) {
  throw new Error(
    "NOTRA_BUILD_PARAMS is not set; run builds through `notra-sites build`"
  );
}
const params = JSON.parse(readFileSync(paramsPath, "utf8"));
const srcDir = process.env.NOTRA_DEV_ROOT
  ? resolve(process.env.NOTRA_DEV_ROOT, "src")
  : fileURLToPath(new URL("src", import.meta.url));
const workDir = resolve(params.workDir);
const siteDir = resolve(workDir, "site");
const codeblocks = params.config.styling?.codeblocks ?? "system";
function shikiThemesFor(setting) {
  if (setting === "system") {
    return { light: "github-light", dark: "github-dark" };
  }
  if (setting === "dark") {
    return { light: "github-dark", dark: "github-dark" };
  }
  return typeof setting === "string"
    ? { light: setting, dark: setting }
    : setting;
}
const shikiThemes = shikiThemesFor(codeblocks);
const smartQuotes = params.config.styling?.smartQuotes !== false;

const markdownFeatures = {
  name: "notra-markdown-features",
  hooks: {
    "astro:config:setup": ({ config }) => {
      // Satteri reads its features lazily, so this covers .md and .mdx.
      config.markdown.processor.options.features.smartPunctuation = smartQuotes;
    },
  },
};

export default defineConfig({
  site: params.publicOrigin,
  srcDir,
  base: params.mount,
  outDir: resolve(workDir, "out", params.area),
  publicDir: resolve(siteDir, "public"),
  cacheDir: resolve(workDir, "cache", params.area),
  trailingSlash: "ignore",
  build: {
    format: "directory",
    assets: "_notra/assets",
    inlineStylesheets: "auto",
  },
  devToolbar: { enabled: false },
  telemetry: false,
  integrations: [
    markdownFeatures,
    mdx({ shikiConfig: { themes: shikiThemes, wrap: false } }),
    ...(params.hasReactComponents
      ? [(await import("@astrojs/react")).default()]
      : []),
  ],
  markdown: {
    shikiConfig: {
      themes: { light: "github-light", dark: "github-dark" },
      wrap: true,
    },
  },
  vite: {
    plugins: [
      tailwindcss(),
      ...(process.env.NOTRA_DEV_HMR_TOKEN
        ? [
            {
              name: "notra-dev-hmr",
              configResolved(config) {
                config.webSocketToken = process.env.NOTRA_DEV_HMR_TOKEN;
              },
              configureServer(server) {
                server.ws.on("connection", (socket, request) => {
                  if (request.headers["x-notra-hmr-reload"] === "1") {
                    socket.send(JSON.stringify({ type: "full-reload" }));
                  }
                });
                const documentToken = process.env.NOTRA_DEV_DOCUMENT_TOKEN;
                const event = process.env.NOTRA_DEV_HMR_EVENT;
                if (documentToken && event) {
                  const [session, revision] = documentToken.split(".");
                  const current = Number(revision);
                  server.ws.on(event, (renderedToken, client) => {
                    if (typeof renderedToken !== "string") {
                      return;
                    }
                    const [renderedSession, renderedRevision, extra] =
                      renderedToken.split(".");
                    const rendered = Number(renderedRevision);
                    if (
                      renderedSession === session &&
                      extra === undefined &&
                      Number.isSafeInteger(rendered) &&
                      rendered >= 1 &&
                      String(rendered) === renderedRevision &&
                      rendered < current
                    ) {
                      client.send({ type: "full-reload" });
                    }
                  });
                }
              },
            },
          ]
        : []),
    ],
    ssr: { noExternal: ["@astrojs/react"] },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (warning.code === "MODULE_LEVEL_DIRECTIVE") {
            return;
          }
          warn(warning);
        },
      },
    },
    resolve: {
      alias: {
        "@site": siteDir,
        "@notra/builtins/SiteAreas.astro": resolve(
          srcDir,
          "components/SiteAreas.astro"
        ),
        "@notra/builtins/ThemeToggle.astro": resolve(
          srcDir,
          "components/ThemeToggle.astro"
        ),
        "@notra/builtins": resolve(srcDir, "builtins"),
        "@notra/custom-css": resolve(workDir, "custom.css"),
      },
    },
    server: {
      fs: {
        allow: [
          workDir,
          resolve("."),
          process.env.NOTRA_DEV_MODULES
            ? realpathSync(process.env.NOTRA_DEV_MODULES)
            : resolve("../../node_modules"),
        ],
      },
    },
    logLevel: "warn",
  },
});
