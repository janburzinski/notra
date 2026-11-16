import { appendFileSync } from "node:fs";

import { Effect } from "effect";

import { askGeoOlostepAiOverviewAnswer } from "../src/geo/olostep";
import { buildGeoContextRequest } from "../src/utils/geo-context";
import { parseGeoContextCapture } from "../src/utils/geo-context-answer";
import { resolveGeoContextSource } from "../src/utils/geo-context-source";

const P: [string, string, string][] = [
  ...[
    "best crm for small businesses",
    "how to reduce aws costs",
    "best accounting software for freelancers",
    "how do i choose a vpn",
    "best email marketing tool for ecommerce",
    "best password manager for families",
    "best laptop for programming",
    "how to start a podcast",
    "what is the best note taking app",
    "best project management tool for agencies",
    "best website builder for small business",
    "best payroll software for startups",
    "how to improve website seo",
    "best online course platform",
    "best help desk software",
    "what is the best ai writing tool",
    "best invoicing app for contractors",
    "how to choose a web hosting provider",
  ].map((p) => [p, "English", "info"] as [string, string, string]),
  ...[
    "beste buchhaltungssoftware für freelancer",
    "bestes crm für kleine unternehmen",
    "welcher passwortmanager ist am sichersten",
    "wie starte ich einen onlineshop",
    "bester stromanbieter für familien",
    "beste projektmanagement software für startups",
  ].map((p) => [p, "German", "info"] as [string, string, string]),
  ...[
    "meilleur crm pour petite entreprise",
    "comment choisir un vpn",
    "meilleur logiciel de comptabilité pour freelance",
  ].map((p) => [p, "French", "info"] as [string, string, string]),
  ...[
    "mejor crm para pequeñas empresas",
    "cómo elegir una vpn",
    "mejor software de contabilidad para autónomos",
  ].map((p) => [p, "Spanish", "info"] as [string, string, string]),
  ...[
    "nike",
    "bitcoin price",
    "weather new york",
    "amazon prime login",
    "nytimes",
    "espn",
    "500 usd to eur",
    "google translate",
  ].map((p) => [p, "English", "nav"] as [string, string, string]),
];

async function context(prompt: string, language: string) {
  const attempts: any[] = [];
  for (let i = 0; i < 3; i++) {
    const t = Date.now();
    const a: any = { i };
    try {
      const res = await fetch("https://api.context.dev/v1/web/scrape", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CONTEXT_DEV_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(
          buildGeoContextRequest("google/ai-overview", prompt, language)
        ),
        signal: AbortSignal.timeout(120_000),
      });
      const j: any = await res.json();
      a.ms = Date.now() - t;
      a.code = j.html?.error_code ?? null;
      a.finalUrl = j.url;
      a.credits = j.key_metadata?.credits_consumed;
      a.requestId = j.request_id;
      try {
        const c = parseGeoContextCapture("google/ai-overview", prompt, j);
        const urls = await Promise.all(
          c.sources
            .slice(0, 20)
            .map((s) =>
              resolveGeoContextSource(s.url, AbortSignal.timeout(15_000)).catch(
                () => null
              )
            )
        );
        a.ok = true;
        a.absent = c.absent;
        a.text = c.text;
        a.sources = urls.filter(Boolean);
      } catch (e) {
        a.ok = false;
        a.err = (e as Error).message;
      }
    } catch (e) {
      a.ms = Date.now() - t;
      a.ok = false;
      a.err = String(e);
    }
    attempts.push(a);
    if (a.ok) {
      break;
    }
  }
  return attempts;
}
async function olostep(prompt: string, language: string) {
  const t = Date.now();
  const exit = await Effect.runPromiseExit(
    askGeoOlostepAiOverviewAnswer(prompt, language)
  );
  if (exit._tag === "Success") {
    const { answer, requestId } = exit.value;
    return {
      ok: true,
      ms: Date.now() - t,
      absent: !!answer.absent,
      text: answer.text,
      sources: answer.sources.map((s) => s.url),
      requestId,
    };
  }
  return {
    ok: false,
    ms: Date.now() - t,
    err: String((exit.cause as any)?.error?.message ?? exit.cause),
  };
}
let next = 0;
const jobs = [...P].sort(() => Math.random() - 0.5);
async function worker() {
  while (next < jobs.length) {
    const [prompt, language, kind] = jobs[next++]!;
    const startedAt = new Date().toISOString();
    const [ctx, olo] = await Promise.all([
      context(prompt, language),
      olostep(prompt, language),
    ]);
    appendFileSync(
      "/tmp/aio-pair/pairs.jsonl",
      `${JSON.stringify({ prompt, language, kind, startedAt, ctx, olo })}\n`
    );
    const last = ctx.at(-1);
    console.log(
      kind,
      language,
      prompt,
      "| ctx:",
      ctx
        .map((a) =>
          a.ok ? (a.absent ? "absent" : "ok") : (a.code ?? a.err?.slice(0, 30))
        )
        .join(","),
      "| olo:",
      olo.ok ? (olo.absent ? "absent" : "ok") : olo.err?.slice(0, 60)
    );
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
