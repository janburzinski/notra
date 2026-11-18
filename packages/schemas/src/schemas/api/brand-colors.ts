import "zod/compile";
import { z } from "@hono/zod-openapi";

import { BRAND_GUIDELINE_HEX_COLOR_REGEX } from "../../constants/dashboard/brand-guidelines";
import {
  getBrandIdentityParamsSchema,
  organizationResponseSchema,
} from "./content";
import { resourceIdSchema } from "./ids";

const brandColorRoleSchema = z
  .enum([
    "primary",
    "secondary",
    "accent",
    "background",
    "foreground",
    "neutral",
    "custom",
  ])
  .openapi({
    description:
      "Role of the color in the palette. custom is for colors outside the standard roles.",
    example: "primary",
  });

const hexColorSchema = z
  .string()
  .trim()
  .regex(BRAND_GUIDELINE_HEX_COLOR_REGEX, "Must be a hex color like #13A0DC");

const brandColorSchema = z
  .object({
    id: z.string().openapi({
      description: "Pass as colorId to update or delete the color.",
    }),
    role: brandColorRoleSchema,
    name: z.string().nullable().openapi({
      description: "Display name of the color, or null when not set.",
    }),
    lightValue: z.string().openapi({
      description: "Hex color for light mode.",
      example: "#13A0DC",
    }),
    darkValue: z.string().nullable().openapi({
      description:
        "Hex color for dark mode. Null when the color has no dark variant.",
    }),
    usage: z.string().nullable().openapi({
      description: "Free-text note on where the color should be used.",
    }),
  })
  .openapi({ description: "A color in a brand identity's palette." });

export const brandColorParamsSchema = getBrandIdentityParamsSchema.extend({
  colorId: resourceIdSchema("colorId").openapi({
    param: { in: "path", name: "colorId" },
    example: "8f2c1d4e-5b6a-4c3d-9e8f-7a6b5c4d3e2f",
  }),
});

export const createBrandColorRequestSchema = z.object({
  role: brandColorRoleSchema.default("custom"),
  name: z.string().trim().max(120).nullable().optional(),
  lightValue: hexColorSchema.openapi({ example: "#13A0DC" }),
  darkValue: hexColorSchema.nullable().optional(),
  usage: z.string().trim().max(240).nullable().optional(),
});

export const patchBrandColorRequestSchema = createBrandColorRequestSchema
  .extend({
    role: brandColorRoleSchema.optional(),
    lightValue: hexColorSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });

export const listBrandColorsResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    colors: z.array(brandColorSchema).openapi({
      description: "Colors of the brand identity in display order.",
    }),
  })
  .openapi({ description: "The brand identity's color palette." });

export const brandColorResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    color: brandColorSchema,
  })
  .openapi({ description: "The created or updated brand color." });

export const deleteBrandColorResponseSchema = z
  .object({
    organization: organizationResponseSchema,
    id: z.string().openapi({ description: "ID of the deleted color." }),
  })
  .openapi({ description: "Confirmation that the brand color was deleted." });
