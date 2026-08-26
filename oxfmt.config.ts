import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  // Keep this migration mechanical. Oxfmt's sorting differs from the previous
  // Biome output and would otherwise rewrite unrelated source files.
  sortImports: false,
  sortPackageJson: false,
  sortTailwindcss: false,
  ignorePatterns: [
    ...ultracite.ignorePatterns,
    "packages/ui/src/**",
    ".agents/skills/**",
    "apps/dashboard/src/components/evilcharts/**",
    "packages/db/migrations/**",
    ".temp/**",
    "**/*.{astro,md,mdx,yaml,yml}",
  ],
});
