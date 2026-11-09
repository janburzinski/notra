import { normalizeSiteMounts } from "@notra/sites-core/utils/mounts";
import { z } from "zod";

const sectionPathSchema = z
  .string()
  .trim()
  .startsWith("/", "Start the path with /, like /changelog")
  .max(200);

/** blog.json `sections`: the paths the site serves its blog and changelog at. */
export const siteSectionsSchema = z
  .strictObject({
    blog: sectionPathSchema
      .optional()
      .describe(
        "Path the blog is served at, like /blog. Leave out to turn the blog off."
      ),
    changelog: sectionPathSchema
      .optional()
      .describe(
        "Path the changelog is served at, like /changelog. Leave out to turn the changelog off."
      ),
  })
  .superRefine((sections, ctx) => {
    try {
      normalizeSiteMounts(sections);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })
  .describe(
    "Turns the blog and changelog on and sets their paths. When set, these replace the Sections setting in the dashboard and apply when a production build goes live."
  );
