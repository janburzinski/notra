import { Body, Container, Head, Html, Link, Preview, Text } from "react-email";

import { EMAIL_THEME } from "../constants/theme";
import type { AutopilotDraftReadyEmailProps } from "../types/autopilot-draft-ready";
import { EMAIL_CONFIG } from "../utils/config";
import { toPreviewText } from "../utils/preview";

const paragraph = {
  color: EMAIL_THEME.foreground,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};
const link = { color: EMAIL_THEME.link, textDecoration: "underline" };
const note = {
  ...paragraph,
  color: EMAIL_THEME.subtleForeground,
  fontSize: "13px",
  lineHeight: "20px",
};

/** A plain note, like one a teammate would send, not a branded notification. */
export const AutopilotDraftReadyEmail = ({
  organizationName = "Acme Inc",
  organizationSlug = "acme",
  draftTitle = "Preview signed-in content locally with mint dev",
  reason = "The new --signed-in flag lets authors preview Visibility content as a signed-in reader, and none of the CLI docs mention it yet.",
  draftKind = "post",
  repository = "acme/website",
  pullRequestNumber = 482,
  pullRequestUrl = "https://github.com/acme/website/pull/482",
  sources = [
    {
      title: "feat(cli): mint dev --signed-in",
      url: "https://github.com/acme/app/pull/1290",
      author: "rohan",
    },
  ],
  reviewLink = `https://app.usenotra.com/${organizationSlug}/autopilot`,
}: AutopilotDraftReadyEmailProps) => (
  <Html>
    <Head />
    <Preview>
      {toPreviewText(reason ? `${draftTitle}. ${reason}` : draftTitle)}
    </Preview>
    <Body
      style={{ backgroundColor: "#ffffff", fontFamily: EMAIL_THEME.fontFamily }}
    >
      <Container style={{ maxWidth: "560px", padding: "24px 20px" }}>
        <Text style={paragraph}>Hi,</Text>
        <Text style={paragraph}>
          I just opened{" "}
          <Link href={pullRequestUrl} style={link}>
            {`a draft ${draftKind}`}
          </Link>{" "}
          in {repository} (#{pullRequestNumber}): "{draftTitle}".
          {reason ? ` ${reason}` : null}
        </Text>
        {sources.length > 0 ? (
          <Text style={paragraph}>
            I used{" "}
            {sources.map((source, index) => (
              <span key={source.url}>
                {index > 0 ? " and " : null}
                <Link href={source.url} style={link}>
                  {source.title}
                </Link>
                {source.author ? ` by @${source.author}` : null}
              </span>
            ))}{" "}
            as context for this.
          </Text>
        ) : null}
        <Text style={paragraph}>
          Nothing is published until it's merged. You can{" "}
          <Link href={reviewLink} style={link}>
            review it in Notra
          </Link>
          .
        </Text>
        <Text style={note}>
          --
          <br />
          Sent by Autopilot, Notra's AI content agent, for {
            organizationName
          }.{" "}
          <Link
            href={`${EMAIL_CONFIG.getAppUrl()}/${organizationSlug}/settings/notifications`}
            style={{ ...link, color: EMAIL_THEME.subtleForeground }}
          >
            Turn off these emails
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
);
