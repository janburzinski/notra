import { afterEach, beforeEach, expect, mock, test } from "bun:test";

import { Effect } from "effect";

import { askGeoContextAnswer } from "../src/geo/context";

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

test("Gemini and opted-out captures never fall back", async () => {
  const fetch = mock<typeof globalThis.fetch>(async () => blockedContext());
  globalThis.fetch = fetch;

  await expect(
    Effect.runPromise(askGeoContextAnswer("google/gemini", "best crm", "en"))
  ).rejects.toThrow("invalid Context capture");
  await expect(
    Effect.runPromise(
      askGeoContextAnswer("google/ai-overview", "best crm", "en", {
        olostepFallback: false,
      })
    )
  ).rejects.toThrow("invalid Context capture");
  expect(fetch.mock.calls.map(([input]) => String(input))).toEqual([
    CONTEXT_URL,
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
