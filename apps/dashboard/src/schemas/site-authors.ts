import { z } from "zod";

/** Author links in the Design form are https-only, stricter than blog.json. */
export const siteAuthorLinkSchema = z.url({ protocol: /^https$/ });
