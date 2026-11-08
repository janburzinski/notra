import { Text } from "react-email";

import { EmailButtonFallbackLink } from "../components/button-fallback-link";
import { EmailCtaButton } from "../components/cta-button";
import { EmailDetailRow } from "../components/detail-row";
import { EmailLayout } from "../components/layout";
import { EmailTitleCard } from "../components/title-card";
import { EMAIL_THEME } from "../constants/theme";
import type { GeoEngineChangeEmailProps } from "../types/geo-engine-change";
import { EMAIL_CONFIG } from "../utils/config";

const paragraph = {
  color: EMAIL_THEME.foreground,
  fontSize: "14px",
  lineHeight: "22px",
};

export const GeoEngineChangeEmail = ({
  organizationName = "Acme Inc",
  organizationSlug = "acme",
  effectiveDate = "Thursday, November 12",
  changes = [
    { from: "GPT-5.6 Sol", to: "ChatGPT" },
    { from: "Claude Opus 5.5", to: "Claude" },
    { from: "Claude Code", to: "Claude" },
  ],
  codingAgents = false,
}: GeoEngineChangeEmailProps) => {
  const settingsLink = `${EMAIL_CONFIG.getAppUrl()}/${organizationSlug}?settings=geo-models`;
  return (
    <EmailLayout
      heading={
        codingAgents
          ? `Coding agent tracking stops on ${effectiveDate}`
          : `Notra tracks each AI assistant as one line from ${effectiveDate}`
      }
      preview={
        codingAgents
          ? `Coding agent tracking stops in ${organizationName} on ${effectiveDate}, and the rest of your tracking moves to the apps your buyers use.`
          : `From ${effectiveDate}, Notra captures answers from the apps your buyers use and shows each assistant as one line.`
      }
      subtext={
        <>
          On <strong>{effectiveDate}</strong>, Notra changes how it tracks AI
          answers for <strong>{organizationName}</strong>.
        </>
      }
    >
      {codingAgents ? (
        <Text style={paragraph}>
          You are one of the few teams that track coding agents in Notra, so we
          wanted to tell you before the change happens. One coding agent run
          costs us many times what a regular AI answer costs, and we can't keep
          running it at today's prices. Tracking for Claude Code, Codex and
          OpenCode therefore stops on {effectiveDate}. If agent tracking matters
          to your team, reply to this email and tell us how you use it, because
          those replies decide how we bring it back.
        </Text>
      ) : null}

      <Text style={paragraph}>
        When buyers ask an AI assistant for advice, they open ChatGPT, Claude,
        Gemini, Copilot or Google and read the answer without ever choosing a
        model version. From {effectiveDate}, Notra tracks each of those
        assistants as a single line in your reports instead of a list of model
        versions.
      </Text>
      <Text style={paragraph}>
        Notra now captures ChatGPT, Gemini, Copilot and Google answers from the
        apps themselves, so the answers in your reports match what a buyer sees
        on screen. Your prompts, competitors and history carry over as they are,
        and you don't need to change any settings.
      </Text>

      {changes.length > 0 ? (
        <EmailTitleCard heading={`What changes in ${organizationName}`}>
          {changes.map((change, index) => (
            <EmailDetailRow
              first={index === 0}
              key={change.from}
              label={change.from}
            >
              {change.to ? `Becomes ${change.to}` : "No longer tracked"}
            </EmailDetailRow>
          ))}
        </EmailTitleCard>
      ) : null}

      <Text style={paragraph}>
        Every plan now includes more AI answers each month, with 6,000 on
        Starter, 16,000 on Growth and 35,000 on Scale. When your organization
        uses all of its answers, tracking pauses until your quota resets, and we
        email you instead of charging for extra answers.
      </Text>

      <EmailCtaButton href={settingsLink}>
        Review your assistants
      </EmailCtaButton>
      <EmailButtonFallbackLink href={settingsLink} />

      <Text style={paragraph}>
        If you have questions about the change, reply to this email and we will
        get back to you.
      </Text>
    </EmailLayout>
  );
};
