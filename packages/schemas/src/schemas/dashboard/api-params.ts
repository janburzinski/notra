import "zod/compile";
import * as z from "zod";

export const contentListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(12),
  date: z.string().optional(),
  projectId: z.string().min(1).optional(),
});

export const contentRecentsQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(3),
});

export const deleteWithTransfersSchema = z.object({
  transfers: z.array(
    z.object({
      orgId: z.string().min(1),
      action: z.enum(["transfer", "delete"]),
    })
  ),
});

export const organizationMembershipActionSchema = z.object({
  organizationId: z.string().min(1),
  action: z.enum(["leave", "delete"]),
});
