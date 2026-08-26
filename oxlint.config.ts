import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";

// Keep Ultracite's provider metadata and deliberate opt-outs, then layer the
// repository's existing policy on top. Enabling every rule from the newer Oxc
// preset would introduce thousands of unrelated failures in this migration.
const coreProvider = {
  ...core,
  plugins: core.plugins.filter(
    (plugin: string) => plugin !== "import" && plugin !== "jsdoc"
  ),
  rules: Object.fromEntries(
    Object.entries(core.rules).filter(([, severity]) => severity === "off")
  ),
};
const nextProvider = {
  ...next,
  rules: Object.fromEntries(
    Object.entries(next.rules).filter(([, severity]) => severity === "off")
  ),
};
const reactProvider = {
  ...react,
  rules: Object.fromEntries(
    Object.entries(react.rules).filter(([, severity]) => severity === "off")
  ),
};

export default defineConfig({
  extends: [coreProvider, reactProvider, nextProvider],
  categories: {
    correctness: "error",
    perf: "error",
    suspicious: "error",
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
    "no-await-in-loop": "off",
    "no-dupe-class-members": "warn",
    "no-empty": "warn",
    "no-global-assign": "warn",
    "no-nested-ternary": "warn",
    "no-new": "off",
    "no-shadow": "off",
    "no-unused-vars": "off",
    "prefer-template": "warn",
    "preserve-caught-error": "off",
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
    "react/exhaustive-effect-dependencies": "off",
    "react/immutability": "off",
    "react/incompatible-library": "off",
    "react/jsx-no-constructed-context-values": "off",
    "react/memo-dependencies": "off",
    "react/no-danger": "off",
    "react/no-array-index-key": "warn",
    "react/no-deriving-state-in-effects": "off",
    "react/no-object-type-as-default-prop": "off",
    "react/no-unstable-nested-components": "off",
    "react/capitalized-calls": "off",
    "react/preserve-manual-memoization": "off",
    "react/refs": "off",
    "react/set-state-in-effect": "off",
    "typescript/consistent-type-definitions": "off",
    "typescript/no-explicit-any": "off",
    "typescript/no-non-null-assertion": "warn",
    "unicorn/no-array-for-each": "off",
    "unicorn/no-array-reverse": "off",
    "unicorn/no-array-sort": "off",
    "unicorn/no-new-array": "off",
    "unicorn/consistent-function-scoping": "off",
    "unicorn/no-document-cookie": "off",
    "unicorn/no-thenable": "off",
    "unicorn/no-useless-fallback-in-spread": "off",
    "unicorn/no-useless-spread": "off",
    "unicorn/prefer-add-event-listener": "off",
    "unicorn/prefer-array-find": "off",
    "unicorn/prefer-at": "warn",
    "unicorn/prefer-node-protocol": "warn",
    "unicorn/prefer-set-has": "off",
    "oxc/no-accumulating-spread": "off",
    "promise/no-promise-in-callback": "off",
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
