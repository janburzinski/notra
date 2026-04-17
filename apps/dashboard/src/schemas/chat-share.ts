// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";

export const chatVisibilitySchema = z.enum([
  "private",
  "link",
  "password",
  "organization",
]);

export type ChatVisibility = z.infer<typeof chatVisibilitySchema>;

const emailSchema = z.string().trim().toLowerCase().email();

export const updateChatShareSchema = z
  .object({
    visibility: chatVisibilitySchema,
    password: z.string().min(4).max(200).optional().nullable(),
    inviteEmails: z.array(emailSchema).max(100).optional(),
    allowFork: z.boolean().optional(),
    expiresAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .transform((value) => (value ? new Date(value) : (value ?? undefined))),
  })
  .superRefine((value, ctx) => {
    if (value.visibility === "password" && !value.password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password"],
        message: "Password required for password-protected sharing",
      });
    }
  });

export type UpdateChatShareInput = z.input<typeof updateChatShareSchema>;

export const unlockShareSchema = z.object({
  password: z.string().min(1).max(200),
});
