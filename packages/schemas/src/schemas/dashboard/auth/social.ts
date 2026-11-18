import "zod/compile";
import { returnToSchema } from "@notra/schemas/dashboard/auth/return-to";
import * as z from "zod";

const socialAuthProviderSchema = z.enum(["google", "github"]);

export const startSocialSignInInputSchema = z.object({
  provider: socialAuthProviderSchema,
  returnTo: returnToSchema,
});
