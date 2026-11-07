import { z } from "zod";

export const postSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  image: z.string().startsWith("/").optional(),
  author: z.string().min(1),
});
