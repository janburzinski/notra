import { z } from "zod";

import { MODEL_IDS } from "@/constants/models";

const modelIdSchema = z.enum(MODEL_IDS);

export const createRunSchema = z.object({ model: modelIdSchema });

export const leaderboardQuerySchema = z.object({
  period: z.enum(["all", "week"]).catch("all"),
  model: z.union([z.literal("all"), modelIdSchema]).catch("all"),
});

export const storedRunSchema = z.object({
  seed: z.number().int().nonnegative(),
  model: modelIdSchema,
  version: z.number().int(),
  createdAt: z.number(),
});

export const beatSchema = z.object({
  at: z.number(),
  tick: z.number().int().nonnegative(),
  hash: z.number().int().nonnegative().max(0xff_ff_ff_ff),
});

/** What the client sends with a heartbeat; the server adds the time it arrived. */
export const beatBodySchema = beatSchema.omit({ at: true });

export const storedReplaySchema = z.object({
  seed: z.number().int().nonnegative(),
  model: modelIdSchema,
  version: z.number().int(),
  score: z.number(),
  replay: z.string().min(1),
});

export const playerIdSchema = z.string().min(1).max(64);

const seedSchema = z.number().int().nonnegative();

/** An approval names the run the moderator watched, by its seed, so it can't vouch for a newer best. */
export const moderationSchema = z.discriminatedUnion("action", [
  z.object({
    playerId: playerIdSchema,
    action: z.literal("approve"),
    seed: seedSchema,
  }),
  z.object({ playerId: playerIdSchema, action: z.literal("ban") }),
]);

export const reviewItemSchema = z.object({
  score: z.number(),
  rank: z.number().int(),
  at: z.number(),
});

export const companySchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  badge: z.string().nullable(),
  url: z.string().nullable(),
});

/** Profiles and sessions from before company badges have no company; they read as none. */
const optionalCompanySchema = companySchema.nullable().catch(null);

export const playerProfileSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  name: z.string(),
  avatar: z.string().nullable(),
  company: optionalCompanySchema,
});

export const sessionPayloadSchema = playerProfileSchema.extend({
  exp: z.number(),
});

export const oauthStateSchema = z.object({
  state: z.string().min(16),
  verifier: z.string().min(43),
  returnTo: z.string(),
  exp: z.number(),
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

export const xTokenSchema = z.object({ access_token: z.string().min(1) });

export const xUserSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    name: z.string(),
    username: z.string().min(1),
    profile_image_url: z.string().url().optional(),
    // the badge an organisation on X gives its people; anything unexpected reads as no badge
    affiliation: z
      .object({
        badge_url: z.string().url().optional(),
        description: z.string().optional(),
        url: z.string().url().optional(),
        user_id: z.array(z.string()).optional(),
      })
      .optional()
      .catch(undefined),
  }),
});

export const scoreMetaSchema = z.object({
  score: z.number(),
  wave: z.number(),
  kills: z.number(),
  model: modelIdSchema,
  at: z.number(),
});
