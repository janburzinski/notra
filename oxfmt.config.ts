const { defineConfig } = require("oxfmt");
const ultracite = require("ultracite/oxfmt").default;

module.exports = defineConfig({
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
    // Temporary compatibility exclusions for files where Oxfmt's output
    // differs from the checked-in Biome formatting. Remove these in a
    // dedicated formatter-only change so feature PRs do not conflict.
    "apps/agent/agent/lib/utils/slack-post-x.ts",
    "apps/console/src/types/store.ts",
    "apps/dashboard/src/components/affected-triggers-warning.tsx",
    "apps/dashboard/src/components/content/editor/nodes/kibo-code-block-node.tsx",
    "apps/dashboard/src/types/brand-identity.ts",
    "apps/dashboard/src/types/workflows/auto-pause.ts",
    "apps/dashboard/src/types/workflows/content-email-digest.ts",
    "apps/dashboard/src/utils/toast-dedupe.ts",
    "apps/dashboard/src/workflows/on-demand-content.ts",
    "apps/dashboard/src/workflows/steps/iris-steps.ts",
    "apps/web/package.json",
    "packages/ai/src/chat/integrations-cache.ts",
    "packages/ai/src/integrations/slack.ts",
    "packages/ai/src/jobs/collection-title.ts",
    "packages/ai/src/model.ts",
    "packages/ai/src/types/integrations.ts",
    "packages/ai/src/types/mcp-tool-index.ts",
    "packages/ai/src/types/organization.ts",
    "packages/ai/src/types/slack.ts",
    "packages/ai/src/utils/iris-poll-linear.ts",
    "packages/db/src/schema.ts",
  ],
});
