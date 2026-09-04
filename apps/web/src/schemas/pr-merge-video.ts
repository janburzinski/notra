// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

import { MAX_SELECTED_PEOPLE } from "../constants/pr-merge-video";
import {
  githubAvatarUrlSchema,
  githubOwnerSlugSchema,
  githubRepoSlugSchema,
} from "./star-video";

const prMergePeriodSchema = z.union([
  z.literal(3),
  z.literal(7),
  z.literal(14),
]);

export const prMergeRepoQuerySchema = z.object({
  owner: githubOwnerSlugSchema,
  repo: githubRepoSlugSchema,
  days: z.coerce.number().pipe(prMergePeriodSchema),
});

const prMergePersonSchema = z.object({
  login: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100).nullable(),
  avatarUrl: githubAvatarUrlSchema,
  merges: z.number().int().min(1).max(1000),
});

export const prMergeVideoInputSchema = z.object({
  owner: githubOwnerSlugSchema,
  repo: githubRepoSlugSchema,
  days: prMergePeriodSchema,
  people: z.array(prMergePersonSchema).min(1).max(MAX_SELECTED_PEOPLE),
});
