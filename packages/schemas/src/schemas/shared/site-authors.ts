import { z } from "zod";

/** Author links Notra writes into blog.json are https-only, stricter than blog.json. */
export const siteAuthorLinkSchema = z.url({
  protocol: /^https$/,
  error: "Use a full https:// URL",
});
