import { expect, test } from "bun:test";
import { Buffer } from "node:buffer";

import { parseGeoContextCapture } from "../src/utils/geo-context-answer";

const PROMPT = "What are the best open world games like GTA?";
const ANSWER =
  "Cyberpunk 2077 is one of the densest open worlds ever built. Like GTA, you navigate a sprawling metropolis and rise through a criminal underworld.";

function metadata(url: string): string {
  const payload = [["r_1", "c_1", null, "rc_1"], null, [url]];
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function capture(response: string) {
  const html = `<html><body>
    <user-query><div class="query-text"><p class="query-text-line">${PROMPT}</p></div></user-query>
    <div id="model-response-message-contentr_1" aria-busy="false">${response}</div>
  </body></html>`;
  return {
    url: "https://gemini.google.com/app/1",
    request_id: "test-context",
    html: { requested: true, success: true, data: html },
  };
}

test("reads Gemini citations hoisted out of their inline chip", () => {
  // The captured HTML closes the paragraph before the chip's block-level
  // button container, so the chip itself is left empty.
  const result = parseGeoContextCapture(
    "google/gemini",
    PROMPT,
    capture(`<p>${ANSWER}<sources-carousel-inline><source-inline-chip></source-inline-chip></sources-carousel-inline></p>
      <div class="source-inline-chip-container"><button aria-label="View source details for citation from Fierce PC." jslog="262206;track:generic_click;BardVeMetadataKey:${metadata("https://www.fiercepc.co.uk/blog/guides/games-like-gta#:~:text=Night")}"><div class="source-label-container">Fierce PC</div></button></div>`)
  );

  expect(result.sources).toEqual([
    {
      url: "https://www.fiercepc.co.uk/blog/guides/games-like-gta",
      title: "Fierce PC",
    },
  ]);
  expect(result.text).toBe(ANSWER);
});

test("keeps a Gemini answer that searched nothing", () => {
  const result = parseGeoContextCapture(
    "google/gemini",
    PROMPT,
    capture(`<p>${ANSWER}</p>`)
  );

  expect(result).toEqual({ text: ANSWER, sources: [], absent: false });
});
