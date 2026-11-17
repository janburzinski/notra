import type { CSSProperties } from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "react-email";

import { FOUNDER_NOTE } from "../constants/founder-note";
import { EMAIL_CONFIG } from "../utils/config";

const paragraph: CSSProperties = {
  color: FOUNDER_NOTE.body,
  fontFamily: FOUNDER_NOTE.fontFamily,
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 18px",
};

const footerText: CSSProperties = {
  color: FOUNDER_NOTE.footer,
  fontFamily: FOUNDER_NOTE.fontFamily,
  fontSize: "12px",
  lineHeight: "1.5",
  margin: "0 0 6px",
};

export const WelcomeEmail = () => {
  const appUrl = EMAIL_CONFIG.getAppUrl();
  const address = EMAIL_CONFIG.physicalAddress;

  return (
    <Html>
      <Head />
      <Preview>A quick note from Dominik, the founder of Notra</Preview>
      <Body style={{ backgroundColor: "#FFFFFF", margin: 0, padding: 0 }}>
        <Container
          style={{
            backgroundColor: "#FFFFFF",
            maxWidth: "520px",
            padding: "40px 24px",
          }}
        >
          <Link href={EMAIL_CONFIG.getSiteUrl()}>
            <Img
              alt="Notra"
              height={36}
              src={FOUNDER_NOTE.logoUrl}
              style={{ display: "block" }}
              width={36}
            />
          </Link>

          <Section style={{ paddingTop: "24px" }}>
            <Text style={paragraph}>Hey,</Text>
            <Text style={paragraph}>
              I'm Dominik, the founder of Notra. Thanks for signing up. This
              email was sent automatically, but if you reply it goes straight to
              my inbox and I read every one.
            </Text>
            <Text style={paragraph}>
              More and more buyers ask ChatGPT, Claude and Gemini which tool to
              use before they ever visit your website. Notra asks those AI
              engines the questions your buyers ask and shows you whether you
              show up, who shows up instead and what to change to win the
              answers you're losing.
            </Text>
            <Text style={{ ...paragraph, margin: 0 }}>
              The best place to start is your first visibility scan.
            </Text>

            <Link
              href={appUrl}
              style={{
                backgroundColor: FOUNDER_NOTE.primary,
                backgroundImage: `url(${FOUNDER_NOTE.buttonSheenUrl})`,
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "100% 100%",
                borderRadius: "41px",
                color: "#FFFFFF",
                display: "inline-block",
                fontFamily: FOUNDER_NOTE.fontFamily,
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: "120%",
                margin: "28px 0",
                padding: "14px 26px",
                textDecoration: "none",
              }}
            >
              Run your first scan
            </Link>

            <Text style={{ ...paragraph, margin: "0 0 28px" }}>
              If you'd rather talk, you can{" "}
              <Link
                href="https://usenotra.com/founder-chat"
                style={{ color: FOUNDER_NOTE.primary }}
              >
                book a chat with me
              </Link>
              .
            </Text>

            <Img
              alt="Dominik Koch"
              src={FOUNDER_NOTE.signatureUrl}
              style={{ display: "block", height: "auto", margin: "0 0 8px" }}
              width={160}
            />
            <Text
              style={{
                color: FOUNDER_NOTE.ink,
                fontFamily: FOUNDER_NOTE.fontFamily,
                fontSize: "15px",
                fontWeight: 600,
                lineHeight: "1.5",
                margin: 0,
              }}
            >
              Dominik Koch
            </Text>
            <Text
              style={{
                color: FOUNDER_NOTE.subtle,
                fontFamily: FOUNDER_NOTE.fontFamily,
                fontSize: "14px",
                lineHeight: "1.5",
                margin: 0,
              }}
            >
              Founder, Notra
            </Text>
          </Section>

          <Section style={{ paddingTop: "48px" }}>
            <Text style={footerText}>
              You're getting this because you signed up for Notra.
            </Text>
            <Text style={{ ...footerText, margin: 0 }}>
              {address.name}, {address.street}, {address.locality}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};
