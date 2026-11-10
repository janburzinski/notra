import { createGateway } from "@ai-sdk/gateway";
import { calculateAiCreditCostCents } from "@notra/ai/billing/ai-credit-cost";
import {
  allowUnmeteredAiInDevelopment,
  autumn,
} from "@notra/ai/billing/autumn";
import { FEATURES } from "@notra/ai/billing/features";
import { resolveOrganizationZdrMode } from "@notra/ai/billing/zdr";
import { logError } from "@notra/ai/utils/server-log";
import { POSTHOG_EVENTS } from "@notra/posthog/events";
import { captureServerEvent, flushPostHogServer } from "@notra/posthog/server";
import { experimental_transcribe as transcribe } from "ai";
import type { SlackAttachment, SlackMessage } from "eve/channels/slack";

import {
  SLACK_AUDIO_CLIP_SUBTYPE,
  SLACK_VOICE_COST_USD_PER_SECOND,
  SLACK_VOICE_MAX_BYTES,
  SLACK_VOICE_MAX_FILES,
  SLACK_VOICE_TIMEOUT_MS,
  SLACK_VOICE_TRANSCRIPTION_MODEL,
} from "../constants/slack-voice";
import type {
  SlackVoiceBilling,
  SlackVoiceTranscription,
} from "../types/slack-voice";

let gateway: ReturnType<typeof createGateway> | undefined;

function getGateway() {
  // On Vercel the gateway also authenticates via OIDC without an explicit key.
  gateway ??= createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY?.trim() || undefined,
  });
  return gateway;
}

function getAudioClipIds(raw: Record<string, unknown>): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(raw.files)) {
    return ids;
  }
  for (const file of raw.files) {
    if (
      typeof file === "object" &&
      file !== null &&
      "subtype" in file &&
      file.subtype === SLACK_AUDIO_CLIP_SUBTYPE &&
      "id" in file &&
      typeof file.id === "string"
    ) {
      ids.add(file.id);
    }
  }
  return ids;
}

/** Voice clips and audio files on the message; eve drops these itself. */
export function getSlackVoiceClips(
  message: Pick<SlackMessage, "attachments" | "raw">
): SlackAttachment[] {
  const clipIds = getAudioClipIds(message.raw);
  return message.attachments
    .filter(
      (attachment) =>
        attachment.url !== undefined &&
        (attachment.type === "audio" ||
          attachment.mimeType?.startsWith("audio/") === true ||
          clipIds.has(attachment.id))
    )
    .slice(0, SLACK_VOICE_MAX_FILES);
}

/** Only send the bot token to Slack's own file host. */
export function isSlackFileUrl(url: string): boolean {
  const parsed = URL.parse(url);
  if (parsed?.protocol !== "https:") {
    return false;
  }
  return (
    parsed.hostname === "files.slack.com" ||
    ((parsed.hostname === "enterprise.slack.com" ||
      parsed.hostname.endsWith(".enterprise.slack.com")) &&
      parsed.pathname.startsWith("/files/"))
  );
}

async function downloadSlackFile(
  url: string,
  botToken: string,
  signal: AbortSignal
): Promise<Uint8Array> {
  if (!isSlackFileUrl(url)) {
    throw new Error("Voice clip is not hosted on Slack");
  }
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${botToken}` },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Slack file fetch returned HTTP ${response.status}`);
  }
  if (response.headers.get("content-type")?.startsWith("text/html")) {
    throw new Error(
      "Slack returned a sign-in page; the app is missing the files:read scope"
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > SLACK_VOICE_MAX_BYTES) {
    throw new Error("Voice clip is larger than 25 MB");
  }
  return bytes;
}

async function requiresZdr(organizationId: string): Promise<boolean> {
  try {
    return (await resolveOrganizationZdrMode(organizationId)) === "required";
  } catch {
    // Billing outage: fail closed so a ZDR workspace never loses it.
    return true;
  }
}

async function transcribeClip(
  clip: SlackAttachment,
  options: { botToken: string; organizationId: string; zdr: boolean }
): Promise<{ text: string; seconds: number }> {
  if (clip.size !== undefined && clip.size > SLACK_VOICE_MAX_BYTES) {
    throw new Error("Voice clip is larger than 25 MB");
  }
  const signal = AbortSignal.timeout(SLACK_VOICE_TIMEOUT_MS);
  const audio = await downloadSlackFile(
    clip.url ?? "",
    options.botToken,
    signal
  );
  const result = await transcribe({
    model: getGateway().transcriptionModel(SLACK_VOICE_TRANSCRIPTION_MODEL),
    audio,
    abortSignal: signal,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...(options.zdr ? { zeroDataRetention: true } : {}),
        user: options.organizationId,
        tags: ["slack-voice"],
      },
    },
  });
  return { text: result.text.trim(), seconds: result.durationInSeconds ?? 0 };
}

/**
 * Charges the transcription to AI credits. It runs before the agent turn,
 * so the usage hook never sees it. Unknown durations bill the minimum.
 */
async function trackSlackVoiceUsage(
  organizationId: string,
  seconds: number,
  billing: SlackVoiceBilling
): Promise<void> {
  if (!autumn || allowUnmeteredAiInDevelopment || !billing.chargeAiCredits) {
    return;
  }
  const cost = calculateAiCreditCostCents(
    {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      totalUsd: Math.max(
        seconds * SLACK_VOICE_COST_USD_PER_SECOND,
        Number.EPSILON
      ),
    },
    SLACK_VOICE_TRANSCRIPTION_MODEL,
    billing.useMarkup
  );
  try {
    await autumn.track({
      customerId: organizationId,
      featureId: FEATURES.AI_CREDITS,
      value: cost.costCents,
      properties: {
        source: "slack_voice",
        model: SLACK_VOICE_TRANSCRIPTION_MODEL,
        billing_basis: cost.billingBasis,
        audio_seconds: seconds,
        cost_cents: cost.costCents,
        markup_applied: billing.useMarkup ? "true" : "false",
      },
    });
    captureServerEvent({
      event: POSTHOG_EVENTS.AI_CREDITS_CHARGED,
      organizationId,
      properties: {
        cost_cents: cost.costCents,
        source: "slack_voice",
        model: SLACK_VOICE_TRANSCRIPTION_MODEL,
        billing_basis: cost.billingBasis,
        audio_seconds: seconds,
        markup_applied: billing.useMarkup,
      },
    });
    await flushPostHogServer();
  } catch (error) {
    logError("Slack voice billing failed", error, { organizationId });
  }
}

/** Transcribes the clips in parallel and bills the ones that succeeded. */
export async function transcribeSlackVoiceClips(
  clips: readonly SlackAttachment[],
  options: {
    botToken: string;
    organizationId: string;
    billing: SlackVoiceBilling;
  }
): Promise<SlackVoiceTranscription> {
  const zdr = await requiresZdr(options.organizationId);
  const results = await Promise.allSettled(
    clips.map((clip) =>
      transcribeClip(clip, {
        botToken: options.botToken,
        organizationId: options.organizationId,
        zdr,
      })
    )
  );
  const transcripts: string[] = [];
  let failed = 0;
  let seconds = 0;
  for (const [index, result] of results.entries()) {
    if (result.status === "rejected") {
      failed += 1;
      logError("Slack voice transcription failed", result.reason, {
        organizationId: options.organizationId,
        fileId: clips[index]?.id,
      });
      continue;
    }
    seconds += result.value.seconds;
    if (result.value.text) {
      transcripts.push(result.value.text);
    }
  }
  if (failed < clips.length) {
    await trackSlackVoiceUsage(
      options.organizationId,
      seconds,
      options.billing
    );
  }
  return {
    transcript: transcripts.length > 0 ? transcripts.join("\n\n") : null,
    failed,
  };
}

/** Model context placed right before the Slack message it belongs to. */
export function formatSlackVoiceContext({
  transcript,
  failed,
}: SlackVoiceTranscription): string {
  if (!transcript) {
    return "The next Slack message includes a voice message that could not be transcribed. Ask the user to type it if you need its content.";
  }
  const missing =
    failed > 0
      ? `\n\n${failed} more voice clip${failed === 1 ? "" : "s"} in that message could not be transcribed. Tell the user which part is missing.`
      : "";
  return `The next Slack message includes a voice message. Transcript:\n\n${transcript}${missing}`;
}

/** The message with its transcript appended, for the dashboard mirror. */
export function withSlackVoiceTranscript(
  message: SlackMessage,
  transcript: string
): SlackMessage {
  const join = (text: string) =>
    [text.trim(), `🎙️ ${transcript}`].filter(Boolean).join("\n\n");
  return {
    ...message,
    text: join(message.text),
    markdown: join(message.markdown),
  };
}
