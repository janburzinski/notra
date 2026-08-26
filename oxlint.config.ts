const { defineConfig } = require("oxlint");
const core = require("ultracite/oxlint/core").default;
const next = require("ultracite/oxlint/next").default;
const react = require("ultracite/oxlint/react").default;

const coreProvider = {
  ...core,
  plugins: core.plugins.filter(
    (plugin: string) => plugin !== "import" && plugin !== "jsdoc"
  ),
  rules: {},
};
const nextProvider = { ...next, rules: {} };
const reactProvider = { ...react, rules: {} };

module.exports = defineConfig({
  extends: [coreProvider, reactProvider, nextProvider],
  categories: {
    correctness: "error",
  },
  ignorePatterns: [
    ...core.ignorePatterns,
    "packages/ui/src/**",
    ".agents/skills/**",
    "apps/dashboard/src/components/evilcharts/**",
    "packages/db/migrations/**",
    ".temp/**",
    "**/*.astro",
  ],
  rules: {
    curly: "warn",
    "no-dupe-class-members": "warn",
    "no-empty": "warn",
    "no-global-assign": "warn",
    "no-nested-ternary": "warn",
    "no-unused-vars": "off",
    "prefer-template": "warn",
    "jsx-a11y/control-has-associated-label": "off",
    "jsx-a11y/interactive-supports-focus": "off",
    "jsx-a11y/no-autofocus": "off",
    "jsx-a11y/click-events-have-key-events": "off",
    "jsx-a11y/no-static-element-interactions": "off",
    "jsx-a11y/prefer-tag-over-role": "off",
    "jsx-a11y/role-supports-aria-props": "warn",
    "nextjs/no-html-link-for-pages": "off",
    "nextjs/no-img-element": "off",
    "oxc/no-barrel-file": "error",
    "react/exhaustive-deps": "warn",
    "react/immutability": "off",
    "react/incompatible-library": "off",
    "react/no-danger": "off",
    "react/no-array-index-key": "warn",
    "react/preserve-manual-memoization": "off",
    "react/refs": "off",
    "react/set-state-in-effect": "off",
    "typescript/consistent-type-definitions": "off",
    "typescript/no-explicit-any": "off",
    "typescript/no-non-null-assertion": "warn",
    "unicorn/no-array-for-each": "off",
    "unicorn/no-new-array": "off",
    "unicorn/no-document-cookie": "off",
    "unicorn/no-thenable": "off",
    "unicorn/no-useless-fallback-in-spread": "off",
    "unicorn/no-useless-spread": "off",
    "unicorn/prefer-at": "warn",
    "unicorn/prefer-node-protocol": "warn",
  },
  overrides: [
    {
      files: ["packages/geo/src/index.ts", "packages/geo/src/feedback.ts"],
      rules: {
        "oxc/no-barrel-file": "off",
      },
    },
  ],
});
