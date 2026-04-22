import { db } from "@notra/db/drizzle";
import { organizations } from "@notra/db/schema";
import { EMAIL_CONFIG } from "@notra/email/utils/config";
import { sendDevEmail } from "@notra/email/utils/dev";
import { getResend } from "@notra/email/utils/resend";
import { eq } from "drizzle-orm";
// biome-ignore lint/performance/noNamespaceImport: Zod recommended way of importing
import * as z from "zod";
import { assertOrganizationAccess } from "@/lib/auth/organization";
import { sendFeedbackEmail } from "@/lib/email/send";
import { authorizedProcedure } from "@/lib/orpc/base";
import { internalServerError } from "@/lib/orpc/utils/errors";

const MAX_MESSAGE_LENGTH = 4000;
const isDevelopment = process.env.NODE_ENV === "development";

const feedbackSentimentSchema = z.enum([
  "sad_crying",
  "sad",
  "happy",
  "excited",
]);

const submitFeedbackInputSchema = z.object({
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  sentiment: feedbackSentimentSchema.optional(),
  organizationId: z.string().min(1).optional(),
  pageUrl: z.string().url().optional(),
});

export const feedbackRouter = {
  submit: authorizedProcedure
    .input(submitFeedbackInputSchema)
    .handler(async ({ context, input }) => {
      let organizationName: string | undefined;
      let organizationSlug: string | undefined;

      if (input.organizationId) {
        const { organizationId } = await assertOrganizationAccess({
          headers: context.headers,
          organizationId: input.organizationId,
          user: context.user,
        });

        try {
          const org = await db.query.organizations.findFirst({
            columns: { name: true, slug: true },
            where: eq(organizations.id, organizationId),
          });

          if (org) {
            organizationName = org.name;
            organizationSlug = org.slug;
          }
        } catch {
          // Non-fatal: feedback should still reach support even if the org
          // lookup fails.
        }
      }

      const payload = {
        to: process.env.FEEDBACK_EMAIL_TO ?? EMAIL_CONFIG.replyTo,
        message: input.message,
        sentiment: input.sentiment,
        userName: context.user.name,
        userEmail: context.user.email,
        organizationName,
        organizationSlug,
        pageUrl: input.pageUrl,
        userAgent: context.headers.get("user-agent") ?? undefined,
      };

      const resend = getResend();

      if (!resend) {
        if (!isDevelopment) {
          throw internalServerError("Email service is not configured");
        }

        await sendDevEmail({
          from: EMAIL_CONFIG.from,
          to: payload.to,
          subject: `New feedback from ${payload.userName}`,
          text: payload.message,
          _mockContext: { type: "feedback", data: payload },
        });

        return { success: true };
      }

      const { error } = await sendFeedbackEmail(resend, payload);

      if (error) {
        throw internalServerError("Failed to send feedback", error);
      }

      return { success: true };
    }),
};
