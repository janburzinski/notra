export const WORKDIR = "/workspace/home";
export const TOOLCHAIN_ENTRIES = ["astro.config.mjs", "src"] as const;
export const TOOLCHAIN_PACKAGE_NAME = "notra-sites-toolchain";
/** Files of the staged toolchain that pin its runtime dependencies. */
export const TOOLCHAIN_MANIFESTS = [
  "package.json",
  "package-lock.json",
] as const;
/** What a hosted build runs; the render fingerprint hashes its bundle. */
export const RENDER_ENTRY = "compiler/build.ts";
export const TOOLCHAIN_EXTERNALS = [
  "astro",
  "satori",
  "@resvg/resvg-js",
  "sharp",
] as const;
/** bun.lock is JSON with trailing commas; strings are matched to skip them. */
export const TRAILING_COMMA = /("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g;
