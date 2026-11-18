import "zod/compile";
import * as z from "zod";

export const externalLoginCompleteResponseSchema = z.looseObject({
  redirect_uri: z.string().url(),
});
