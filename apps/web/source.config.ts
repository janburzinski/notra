import { defineCollections, defineConfig } from "fumadocs-mdx/config";
import * as z from "zod";

import { CODE_THEMES } from "./src/constants/content";

export const changelog = defineCollections({
  type: "doc",
  dir: "./src/content/changelog",
  schema: z.object({
    title: z.string(),
    date: z.string(),
    description: z.string(),
  }),
});

export default defineConfig({
  mdxOptions: {
    rehypeCodeOptions: {
      themes: CODE_THEMES,
    },
  },
});
