import { describe, expect, test } from "bun:test";

import {
  GEO_CLAUDE_CODE_ENGINE_IDS,
  GEO_CODEX_ENGINE_IDS,
  GEO_OPENCODE_ENGINE_ID,
} from "@notra/geo-core/constants/geo";
import { GeoPromptAnswerThread } from "@notra/ui/components/geo/geo-prompt-answer-thread";
import { renderToStaticMarkup } from "react-dom/server";

describe("GEO answer theme scoping", () => {
  test.each([
    GEO_CLAUDE_CODE_ENGINE_IDS[0],
    GEO_CODEX_ENGINE_IDS[0],
    GEO_OPENCODE_ENGINE_ID,
  ])("scopes dark tokens and readable foreground locally for %s", (engine) => {
    const html = renderToStaticMarkup(
      <GeoPromptAnswerThread
        result={{ engine, excerpt: "A readable answer", mentioned: true }}
        prompt="A question"
        timestamp="2026-10-14T00:00:00Z"
      />
    );
    const rootClass = html.match(/<div class="([^"]+)"/u)?.[1] ?? "";
    expect(rootClass.split(" ")).toContain("dark");
    expect(rootClass.split(" ")).toContain("text-foreground");
    expect(rootClass.split(" ")).toContain("scheme-dark");
  });

  test.each([
    "openai/gpt-6-astra",
    "anthropic/claude-opus-5",
    "google/gemini-3.8-flash",
    "perplexity/sonar",
  ])("does not force a dark theme on the chat skin for %s", (engine) => {
    const html = renderToStaticMarkup(
      <GeoPromptAnswerThread
        result={{ engine, excerpt: "A readable answer", mentioned: true }}
        prompt="A question"
        timestamp="2026-10-14T00:00:00Z"
      />
    );
    const rootClass = html.match(/<div class="([^"]+)"/u)?.[1] ?? "";
    expect(rootClass.split(" ")).not.toContain("dark");
    expect(rootClass.split(" ")).not.toContain("scheme-dark");
  });
});
