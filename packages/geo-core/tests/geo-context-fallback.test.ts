import { afterEach, beforeEach, expect, mock, test } from "bun:test";

import { Effect, Layer } from "effect";

import { GeoModelService } from "../src/deps";
import { askGeoContextAnswer, askGeoGoogleAnswer } from "../src/geo/context";
import type { GeoGroundedAnswer } from "../src/types/geo";
import type { GeoModelServiceShape } from "../src/types/model";

const originalFetch = globalThis.fetch;
const originalOlostepKey = process.env.GEO_OLOSTEP_API_KEY_ENV;
const originalContextKey = process.env.CONTEXT_DEV_API_KEY;

const CONTEXT_URL = "https://api.context.dev/v1/web/scrape";
const OLOSTEP_URL = "https://api.olostep.com/v1/scrapes";
const ANSWER =
  "Acme CRM and Example CRM are popular picks for small teams that want simple pipelines and fair pricing.";

function restore(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

beforeEach(() => {
  process.env.GEO_OLOSTEP_API_KEY_ENV = "test-only";
  process.env.CONTEXT_DEV_API_KEY = "test-only";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  restore("GEO_OLOSTEP_API_KEY_ENV", originalOlostepKey);
  restore("CONTEXT_DEV_API_KEY", originalContextKey);
});

function blockedContext() {
  return Response.json({
    url: "https://www.google.com/search?q=best+crm",
    request_id: "test-context",
    html: {
      requested: true,
      success: false,
      data: null,
      error_code: "WEBSITE_ACCESS_ERROR",
    },
  });
}

test("a blocked AI Overview capture falls back to Olostep's parser", async () => {
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = mock<typeof fetch>(async (input, init) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body ?? "null")) });
    if (url === CONTEXT_URL) {
      return blockedContext();
    }
    return Response.json({
      id: "scrape-1",
      result: {
        json_content: JSON.stringify({
          answer_markdown: ANSWER,
          sources: [{ title: "Acme", url: "https://acme.example.com/crm" }],
        }),
      },
    });
  });

  const answer = await Effect.runPromise(
    askGeoContextAnswer("google/ai-overview", "best crm", "German")
  );

  expect(answer.text).toBe(ANSWER);
  expect(answer.sources).toEqual([
    { title: "Acme", url: "https://acme.example.com/crm" },
  ]);
  expect(answer.surfaces?.provider).toBe("olostep");
  expect(calls.map((call) => call.url)).toEqual([CONTEXT_URL, OLOSTEP_URL]);
  expect(calls[1]?.body).toMatchObject({
    url_to_scrape: "https://www.google.com/search?q=best+crm&hl=de&gl=de",
    parser: { id: "@olostep/google-ai-overview-results" },
  });
  // Olostep has no German nodes and rejects `country: "DE"` with a 400.
  expect(calls[1]?.body).not.toHaveProperty("country");
});

test("a failed Gemini capture falls back to Olostep's Gemini parser", async () => {
  const calls: { url: string; body: unknown }[] = [];
  globalThis.fetch = mock<typeof fetch>(async (input, init) => {
    const url = String(input);
    calls.push({ url, body: JSON.parse(String(init?.body ?? "null")) });
    if (url === CONTEXT_URL) {
      return blockedContext();
    }
    return Response.json({
      id: "scrape-3",
      result: { json_content: JSON.stringify({ answer_markdown: ANSWER }) },
    });
  });

  const answer = await Effect.runPromise(
    askGeoContextAnswer("google/gemini", "best crm", "English")
  );

  expect(answer.text).toBe(ANSWER);
  expect(answer.sources).toEqual([]);
  expect(calls.map((call) => call.url)).toEqual([CONTEXT_URL, OLOSTEP_URL]);
  expect(calls[1]?.body).toMatchObject({
    url_to_scrape: "https://gemini.google.com/app?q=best+crm&hl=en",
    parser: { id: "@olostep/gemini-results" },
    country: "US",
  });
});

test("opted-out captures never fall back", async () => {
  const fetch = mock<typeof globalThis.fetch>(async () => blockedContext());
  globalThis.fetch = fetch;

  await expect(
    Effect.runPromise(
      askGeoContextAnswer("google/gemini", "best crm", "en", {
        olostepFallback: false,
      })
    )
  ).rejects.toThrow("invalid Context capture");
  expect(fetch.mock.calls.map(([input]) => String(input))).toEqual([
    CONTEXT_URL,
  ]);
});

test("a failed fallback fails the check with the Olostep cause", async () => {
  globalThis.fetch = mock<typeof fetch>(async (input) =>
    String(input) === CONTEXT_URL
      ? blockedContext()
      : Response.json({ error: "down" }, { status: 502 })
  );

  await expect(
    Effect.runPromise(
      askGeoContextAnswer("google/ai-overview", "best crm", "en")
    )
  ).rejects.toThrow("failed through Context and its Olostep fallback");
});

test("Olostep's no-overview result only counts on a page with results", async () => {
  const overview = (organic: unknown[]) =>
    Response.json({
      id: "scrape-2",
      result: {
        json_content: JSON.stringify({
          message: "no-ai-overview-found",
          organic_results: organic,
        }),
      },
    });
  globalThis.fetch = mock<typeof fetch>(async (input) =>
    String(input) === CONTEXT_URL ? blockedContext() : overview([])
  );
  await expect(
    Effect.runPromise(
      askGeoContextAnswer("google/ai-overview", "best crm", "en")
    )
  ).rejects.toThrow("failed through Context and its Olostep fallback");

  globalThis.fetch = mock<typeof fetch>(async (input) =>
    String(input) === CONTEXT_URL
      ? blockedContext()
      : overview([{ title: "Acme", link: "https://acme.example.com" }])
  );
  const answer = await Effect.runPromise(
    askGeoContextAnswer("google/ai-overview", "best crm", "en")
  );
  expect(answer.absent).toBe(true);
});

test("an uncited Olostep answer fails the check like an uncited Context capture", async () => {
  globalThis.fetch = mock<typeof fetch>(async (input) =>
    String(input) === CONTEXT_URL
      ? blockedContext()
      : Response.json({
          id: "scrape-3",
          result: {
            json_content: JSON.stringify({
              answer_markdown: ANSWER,
              sources: [],
            }),
          },
        })
  );

  await expect(
    Effect.runPromise(
      askGeoContextAnswer("google/ai-overview", "best crm", "en")
    )
  ).rejects.toThrow("failed through Context and its Olostep fallback");
});

test("a Gemini check that Context and Olostep both miss is answered by the API", async () => {
  const redirect =
    "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc";
  globalThis.fetch = mock<typeof fetch>(async (input) => {
    const url = String(input);
    if (url === CONTEXT_URL) {
      return blockedContext();
    }
    if (url === redirect) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://acme.example.com/crm" },
      });
    }
    return Response.json({ code: "access_restricted" }, { status: 403 });
  });
  const groundedAnswer = mock<GeoModelServiceShape["groundedAnswer"]>(
    (input) => {
      const answer: GeoGroundedAnswer = {
        text: ANSWER,
        sources: [{ url: redirect, title: "acme.example.com" }],
        grounding: {
          queries: ["best crm"],
          sources: [
            {
              url: redirect,
              title: "acme.example.com",
              domain: "vertexaisearch.cloud.google.com",
            },
          ],
        },
        finishReason: "stop",
        zdrEnforced: input.zdr !== "none",
        usage: {
          inputTokens: 1,
          outputTokens: 1,
          totalTokens: 2,
          inputTokenDetails: {
            noCacheTokens: 1,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokenDetails: { textTokens: 1, reasoningTokens: 0 },
          modelId: "google/gemini-3.8-flash",
        },
      };
      return Effect.succeed(answer);
    }
  );
  const models = Layer.succeed(
    GeoModelService,
    GeoModelService.of({ groundedAnswer } as unknown as GeoModelServiceShape)
  );

  const answer = await Effect.runPromise(
    askGeoGoogleAnswer("google/gemini", "best crm", "English", {
      organizationId: "org",
      zdr: "none",
    }).pipe(Effect.provide(models))
  );

  expect(groundedAnswer.mock.calls[0]?.[0]).toMatchObject({
    engine: { model: "google/gemini-3.8-flash" },
    messages: [{ role: "user", content: "best crm" }],
  });
  expect(answer.text).toBe(ANSWER);
  expect(answer.sources).toEqual([
    { url: "https://acme.example.com/crm", title: "acme.example.com" },
  ]);
  expect(answer.grounding.sources[0]?.domain).toBe("acme.example.com");
});

test("AI Overview never falls back to the API", async () => {
  globalThis.fetch = mock<typeof fetch>(async (input) =>
    String(input) === CONTEXT_URL
      ? blockedContext()
      : Response.json({ code: "down" }, { status: 502 })
  );
  const groundedAnswer = mock<GeoModelServiceShape["groundedAnswer"]>();
  const models = Layer.succeed(
    GeoModelService,
    GeoModelService.of({ groundedAnswer } as unknown as GeoModelServiceShape)
  );

  await expect(
    Effect.runPromise(
      askGeoGoogleAnswer("google/ai-overview", "best crm", "en", {
        organizationId: "org",
        zdr: "none",
      }).pipe(Effect.provide(models))
    )
  ).rejects.toThrow("failed through Context and its Olostep fallback");
  expect(groundedAnswer).not.toHaveBeenCalled();
});
