import "zod/compile";
import { z } from "@hono/zod-openapi";

import {
  skillContentSchema as sharedSkillContentSchema,
  skillDescriptionSchema as sharedSkillDescriptionSchema,
  skillNameSchema as sharedSkillNameSchema,
} from "../shared/skills";

const skillNameSchema = sharedSkillNameSchema.openapi({
  description: "Skill name. Lowercase letters, digits, and hyphens only.",
  example: "humanizer",
});

const skillDescriptionSchema = sharedSkillDescriptionSchema.openapi({
  description: "Short description of when the skill should be used.",
  example: "Polish near-final drafts so they sound natural and specific.",
});

const skillContentSchema = sharedSkillContentSchema.openapi({
  description: "Full skill instructions, typically Markdown.",
  example:
    "# Humanizer\n\nRewrite the draft so it reads like a person wrote it. Remove filler, vary sentence length, and keep concrete details.",
});

export const skillParamsSchema = z.object({
  name: skillNameSchema,
});

export const createSkillRequestSchema = z
  .object({
    name: skillNameSchema,
    description: skillDescriptionSchema,
    content: skillContentSchema,
  })
  .openapi("CreateSkillRequest");

export const patchSkillRequestSchema = z
  .object({
    name: skillNameSchema.optional(),
    description: skillDescriptionSchema.optional(),
    content: skillContentSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  })
  .openapi("PatchSkillRequest");

const skillSummarySchema = z
  .object({
    id: z.string(),
    name: z.string().openapi({
      description:
        "Unique within the organization. Use it as {name} in /v1/skills/{name}.",
    }),
    description: z.string().openapi({
      description: "Short description of when the skill should be used.",
    }),
    isSystem: z.boolean().openapi({
      description:
        "True for built-in skills provided by Notra. System skills can be edited but not renamed or deleted.",
    }),
    updatedAt: z.string(),
  })
  .openapi("SkillSummary");

const skillSchema = skillSummarySchema
  .extend({
    content: z.string().openapi({
      description: "Full skill instructions, typically Markdown.",
    }),
    createdAt: z.string(),
  })
  .openapi("Skill");

export const listSkillsResponseSchema = z
  .object({
    skills: z.array(skillSummarySchema).openapi({
      description: "Skills sorted by name, without their content.",
    }),
  })
  .openapi("ListSkillsResponse");

export const skillResponseSchema = z
  .object({
    skill: skillSchema,
  })
  .openapi("SkillResponse");

export const createSkillResponseSchema = z
  .object({
    skill: skillSchema,
  })
  .openapi("CreateSkillResponse");

export const patchSkillResponseSchema = z
  .object({
    skill: skillSchema,
  })
  .openapi("PatchSkillResponse");

export const deleteSkillResponseSchema = z
  .object({
    success: z.literal(true),
  })
  .openapi("DeleteSkillResponse");
