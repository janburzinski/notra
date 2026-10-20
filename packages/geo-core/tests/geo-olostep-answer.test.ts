import { describe, expect, test } from "bun:test";

import { geoOlostepAnswerSchema } from "../src/schemas/geo-olostep";
import { geoOlostepAnswer } from "../src/utils/geo-olostep-answer";

const answerOf = (payload: unknown) =>
  geoOlostepAnswer(geoOlostepAnswerSchema.parse(payload));

describe("Olostep AI Overview answers", () => {
  test("a reported missing overview is stored as a miss", () => {
    const answer = answerOf({
      answer_markdown: "",
      sources: [],
      text_blocks: [],
      message: "no-ai-overview-found",
    });
    expect(answer.absent).toBe(true);
    expect(answer.text).toBe("");
  });

  test("an empty or unrecognized payload is not a miss", () => {
    for (const payload of [{}, { message: "rate-limited" }]) {
      const answer = answerOf(payload);
      expect(answer.absent).toBe(false);
      expect(answer.text).toBe("");
    }
  });

  test("an overview with text is a regular answer", () => {
    const answer = answerOf({
      answer_markdown: "Yes, creatine is generally safe.",
      sources: [{ url: "https://www.mayoclinic.org/creatine", title: "Mayo" }],
    });
    expect(answer.absent).toBe(false);
    expect(answer.sources).toEqual([
      { title: "Mayo", url: "https://www.mayoclinic.org/creatine" },
    ]);
  });
});
