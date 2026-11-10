import { Row, Section, Text } from "react-email";

import { EmailCtaButton } from "../components/cta-button";
import {
  GeoActionCard,
  GeoChangeList,
  GeoMetricCell,
  GeoShareTable,
} from "../components/geo-recap";
import { EmailLayout } from "../components/layout";
import { EmailNotificationSettingsNote } from "../components/notification-settings-note";
import { EmailTitleCard } from "../components/title-card";
import { EMAIL_THEME } from "../constants/theme";
import type {
  FirstScanResultsEmailProps,
  GeoRecapItem,
  GeoRecapShareRow,
} from "../types/geo-recap";
import { EMAIL_CONFIG } from "../utils/config";
import { engineEmailLogoSrc } from "../utils/engine-logo";

const captionStyle = {
  color: EMAIL_THEME.subtleForeground,
  fontSize: "12px",
  margin: 0,
} as const;

function plural(count: number, singular: string, pluralForm: string) {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : pluralForm}`;
}

const NO_SHARE_ROWS: GeoRecapShareRow[] = [];
const NO_ITEMS: GeoRecapItem[] = [];

const FIRST_SCAN_RESULTS_HEADLINE = "Your first AI visibility results are in";

export const FirstScanResultsEmail = ({
  organizationName = "Acme Inc",
  organizationSlug = "acme",
  brandName = "Acme",
  visibilityLabel = "0%",
  answersChecked = 0,
  promptCount = 0,
  engines = NO_SHARE_ROWS,
  mentionedIn = NO_ITEMS,
  mentionedRemaining = 0,
  competitors = NO_SHARE_ROWS,
  action,
  dashboardLink = `${EMAIL_CONFIG.getAppUrl()}/${organizationSlug}/geo`,
}: FirstScanResultsEmailProps) => {
  const named = mentionedIn.length > 0;
  const asked = `We asked ${plural(engines.length, "AI assistant", "AI assistants")} ${plural(promptCount, "question", "questions")} your customers ask.`;
  const subtext = named
    ? `${asked} Here's where ${brandName} shows up today.`
    : `${asked} None of the answers named ${brandName} yet, so here's who they recommend instead.`;

  return (
    <EmailLayout
      heading={FIRST_SCAN_RESULTS_HEADLINE}
      preview={subtext}
      subtext={subtext}
    >
      <Section>
        <EmailTitleCard heading="Your baseline">
          <Row>
            <GeoMetricCell label="Visibility" value={visibilityLabel} />
            <GeoMetricCell
              last
              label="AI answers checked"
              value={answersChecked.toLocaleString("en-US")}
            />
          </Row>
        </EmailTitleCard>
      </Section>

      {named && engines.length > 0 ? (
        <Section className="mt-4">
          <EmailTitleCard
            action={<Text style={captionStyle}>Mentioned in</Text>}
            heading="By assistant"
          >
            <GeoShareTable rows={engines} />
          </EmailTitleCard>
        </Section>
      ) : null}

      {named ? (
        <Section className="mt-4">
          <EmailTitleCard heading="Where you already show up">
            <GeoChangeList
              items={mentionedIn}
              remainingCount={mentionedRemaining}
            />
          </EmailTitleCard>
        </Section>
      ) : null}

      {competitors.length > 1 ? (
        <Section className="mt-4">
          <EmailTitleCard
            action={<Text style={captionStyle}>Share of answers</Text>}
            heading="Who AI recommends"
          >
            <GeoShareTable rows={competitors} />
          </EmailTitleCard>
        </Section>
      ) : null}

      {action ? (
        <Section className="mt-4">
          <GeoActionCard action={action} />
        </Section>
      ) : null}

      <EmailCtaButton href={dashboardLink}>Open overview</EmailCtaButton>

      <Text
        style={{
          ...captionStyle,
          fontSize: "13px",
          lineHeight: 1.5,
          margin: 0,
          textAlign: "center",
        }}
      >
        Notra keeps checking on your schedule and emails you when something
        moves.
      </Text>

      <EmailNotificationSettingsNote
        organizationName={organizationName}
        organizationSlug={organizationSlug}
      />
    </EmailLayout>
  );
};

FirstScanResultsEmail.PreviewProps = {
  organizationName: "Klarvoice",
  organizationSlug: "klarvoice",
  brandName: "Klarvoice",
  visibilityLabel: "18%",
  answersChecked: 168,
  promptCount: 42,
  engines: [
    {
      name: "Perplexity",
      shareLabel: "31%",
      iconSrc: engineEmailLogoSrc("perplexity"),
    },
    {
      name: "ChatGPT",
      shareLabel: "24%",
      iconSrc: engineEmailLogoSrc("openai"),
    },
    {
      name: "Claude",
      shareLabel: "12%",
      iconSrc: engineEmailLogoSrc("anthropic"),
    },
    {
      name: "Gemini",
      shareLabel: "5%",
      iconSrc: engineEmailLogoSrc("google"),
    },
  ],
  mentionedIn: [
    {
      id: "p1",
      title: "best ai transcription app for german meetings",
      changes: [
        {
          id: "mentioned",
          detail: "Named by 4 of 4 assistants, best rank #1",
          tone: "up",
        },
      ],
    },
    {
      id: "p2",
      title: "desktop dictation software that works offline",
      changes: [
        {
          id: "mentioned",
          detail: "Named by 3 of 4 assistants, best rank #2",
          tone: "up",
        },
      ],
    },
    {
      id: "p3",
      title: "otter alternatives for small teams",
      changes: [
        {
          id: "mentioned",
          detail: "Named by 2 of 4 assistants, best rank #4",
          tone: "up",
        },
      ],
    },
  ],
  mentionedRemaining: 5,
  competitors: [
    { name: "Otter", shareLabel: "54%" },
    { name: "Rev", shareLabel: "33%" },
    { name: "Descript", shareLabel: "21%" },
    { name: "Klarvoice", shareLabel: "18%", isOwnBrand: true },
  ],
  action: {
    eyebrow: "Biggest gap to close first",
    title: "Best transcription app for interviews with speaker labels",
    body: "You show up in 0% of these answers. Otter and Rev are named instead.",
    href: "https://app.usenotra.com/klarvoice/geo/gaps",
    label: "Write a post for it",
  },
  dashboardLink: "https://app.usenotra.com/klarvoice/geo",
} satisfies FirstScanResultsEmailProps;

export default FirstScanResultsEmail;
