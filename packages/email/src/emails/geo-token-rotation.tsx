import { Text } from "react-email";

import { EmailButtonFallbackLink } from "../components/button-fallback-link";
import { EmailCtaButton } from "../components/cta-button";
import { EmailLayout } from "../components/layout";
import type { GeoTokenRotationEmailProps } from "../types/geo-token-rotation";
import { EMAIL_CONFIG } from "../utils/config";

const PARAGRAPH = "mt-0 mb-4 text-[15px] leading-[24px] text-[#171717]";

export const GeoTokenRotationEmail = ({
  organizationName = "Acme Inc",
  organizationSlug = "acme",
  deadline = "October 25",
}: GeoTokenRotationEmailProps) => {
  const apiKeysLink = `${EMAIL_CONFIG.getAppUrl()}/${organizationSlug}/api-keys`;

  return (
    <EmailLayout
      heading="Please rotate your tracking token"
      preview={`Your current tracking token for ${organizationName} stops working on ${deadline}`}
    >
      <Text className={PARAGRAPH}>Hey,</Text>

      <Text className={PARAGRAPH}>
        We've rotated the key Notra uses to sign AI traffic tracking tokens.
        Your site is still sending data to <strong>{organizationName}</strong>{" "}
        and your current token keeps working for now, so nothing is broken yet.
      </Text>

      <Text className={PARAGRAPH}>
        On <strong>{deadline}</strong> we'll remove the old key, and your
        current token will stop working. Please rotate it before then: open your
        API keys page, click <strong>Rotate</strong> on the tracking token, then
        update <strong>NOTRA_GEO_TOKEN</strong> on your site and redeploy. Your
        old token stops working the moment you rotate, so do both steps
        together.
      </Text>

      <EmailCtaButton href={apiKeysLink}>Rotate tracking token</EmailCtaButton>
      <EmailButtonFallbackLink href={apiKeysLink} />

      <Text className={PARAGRAPH}>
        If you have any questions, reply to this email. We read every single
        one.
      </Text>

      <Text className={PARAGRAPH}>
        Cheers,
        <br />
        Dominik & the Notra team
      </Text>
    </EmailLayout>
  );
};
