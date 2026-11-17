import { applicablePlatformEnum, referenceTypeEnum } from "@notra/db/schema";
import { z } from "zod";

import { SHA256_HEX_REGEX } from "../constants/reference-snapshot";

export const referenceInputSchema = z
  .object({
    type: z.enum(referenceTypeEnum.enumValues),
    content: z.string().min(1).max(10_000),
    note: z.string().min(1).optional(),
    applicableTo: z
      .array(z.enum(applicablePlatformEnum.enumValues))
      .min(1)
      .optional(),
    sourceUrl: z
      .url({ protocol: /^https?$/ })
      .max(2048)
      .optional(),
    sourceSnapshotKey: z.string().min(1).optional(),
    sourceContentHash: z.string().regex(SHA256_HEX_REGEX).optional(),
    sourceCapturedAt: z.iso.datetime().optional(),
    authorName: z.string().min(1).nullish(),
    authorHandle: z.string().min(1).nullish(),
    title: z.string().min(1).nullish(),
    publishedAt: z.iso.datetime().nullish(),
    likes: z.number().int().min(0).nullish(),
    retweets: z.number().int().min(0).nullish(),
    replies: z.number().int().min(0).nullish(),
  })
  .refine(
    (reference) => reference.type === "custom" || Boolean(reference.sourceUrl),
    {
      message: "sourceUrl is required for non-custom references",
      path: ["sourceUrl"],
    }
  );

export const addReferenceInputSchema = referenceInputSchema;
