import { publicWebsiteHostname } from "@notra/geo-core/schemas/url";
import { createParser } from "nuqs/server";

export const parseAsOnboardingWebsite = createParser({
  parse: publicWebsiteHostname,
  serialize: String,
});
