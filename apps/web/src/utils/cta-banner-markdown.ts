import { AUTH_SIGNUP_URL } from "@/constants/auth";
import { CTA_BANNER_CONTACT_HREF } from "@/constants/landing/cta-banner";
import { markdownSection } from "@/utils/markdown";
import { SITE_URL } from "@/utils/urls";

import en from "../../messages/en.json";

const cta = en.landing.cta;

export function buildCtaBannerMarkdown() {
  return markdownSection(cta.heading, [
    cta.subcopy,
    "",
    `[${cta.primary}](${AUTH_SIGNUP_URL})`,
    "",
    `[${cta.secondary}](${new URL(CTA_BANNER_CONTACT_HREF, SITE_URL).href})`,
  ]);
}
