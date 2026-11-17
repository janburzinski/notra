import type { ArtifactBlock } from "@notra/ai/types/artifact";

import type { AutopilotFindingView } from "@/types/autopilot";

/**
 * Dev-only fixtures for the artifact iteration playground. A daily brief with
 * three written posts and one idea, plus scripted revisions so asking for
 * changes feels real without GitHub or a model.
 */

const NOW = new Date("2026-11-16T08:00:00Z");

function finding(
  partial: Partial<AutopilotFindingView> &
    Pick<AutopilotFindingView, "id" | "kind" | "title" | "summary" | "status">
): AutopilotFindingView {
  const base = {
    organizationId: "org_demo",
    runId: "run_demo",
    fingerprint: partial.id,
    evidence: {},
    repository: "acme/website",
    pullRequestNumber: null,
    pullRequestUrl: null,
    branch: null,
    headSha: null,
    postId: null,
    errorMessage: null,
    claimToken: null,
    claimedAt: null,
    mergedAt: null,
    dismissedAt: null,
    openedAt: NOW,
    publishAt: null,
    publishHoldReason: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
  // The view is the database row; the playground fills only what renders.
  return { ...base, ...partial } as unknown as AutopilotFindingView;
}

export const ITERATE_FINDINGS: AutopilotFindingView[] = [
  finding({
    id: "f_webhooks",
    kind: "commits",
    title: "Blog post: Webhooks now retry for 72 hours",
    summary: "A blog post based on your recently shipped changes.",
    status: "proposed",
    pullRequestNumber: 412,
    pullRequestUrl: "https://github.com/acme/website/pull/412",
    branch: "notra/webhooks-retry",
    headSha: "a1",
    evidence: {
      pullRequests: [
        {
          number: 1893,
          title: "feat(webhooks): exponential backoff up to 72h",
          url: "https://github.com/acme/app/pull/1893",
          author: "mira",
        },
        {
          number: 1901,
          title: "feat(webhooks): replay failed deliveries from the dashboard",
          url: "https://github.com/acme/app/pull/1901",
          author: "jonas",
        },
      ],
    },
  }),
  finding({
    id: "f_vs",
    kind: "comparisons",
    title: "Acme vs. Hookdeck: which webhook gateway fits a small team",
    summary:
      "AI answers name Hookdeck and Svix for this question and never you.",
    status: "proposed",
    pullRequestNumber: 415,
    pullRequestUrl: "https://github.com/acme/website/pull/415",
    branch: "notra/acme-vs-hookdeck",
    headSha: "b1",
    evidence: {
      keyword: "best webhook gateway for startups",
      competitors: ["Hookdeck", "Svix"],
      target: { kind: "prompt", before: 0, promptId: "p1" },
    },
  }),
  finding({
    id: "f_idempotency",
    kind: "keywords",
    title: "How to make webhook handlers idempotent",
    summary: "Ranks 14 on Google; a focused guide could reach the top 5.",
    status: "proposed",
    pullRequestNumber: 417,
    pullRequestUrl: "https://github.com/acme/website/pull/417",
    branch: "notra/idempotent-webhooks",
    headSha: "c1",
    publishAt: new Date("2026-11-18T09:00:00Z"),
    evidence: {
      keyword: "idempotent webhook handler",
      target: {
        kind: "search",
        query: "idempotent webhook handler",
        before: 14,
      },
    },
  }),
  finding({
    id: "f_idea",
    kind: "keywords",
    title: "Debugging webhook signature mismatches",
    summary: "People search this 1.2k times a month; nobody answers it well.",
    status: "suggested",
    evidence: { keyword: "webhook signature mismatch" },
  }),
];

export const ITERATE_ARTIFACT = {
  title: "Three posts ready, one idea worth writing",
  summary:
    "Webhook retries shipped this week, so the lead post explains them. Two more posts close gaps where AI answers and Google skip you.",
  blocks: [
    { type: "autopilot", findingIds: ["f_webhooks"] },
    {
      type: "text",
      markdown:
        "## Where you're missing\n\nAI answers for webhook gateways name Hookdeck and Svix and never Acme. Google puts your idempotency docs on page two.",
    },
    { type: "autopilot", findingIds: ["f_vs", "f_idempotency"] },
    { type: "text", markdown: "## Worth writing" },
    { type: "autopilot", findingIds: ["f_idea"] },
    {
      type: "text",
      markdown:
        "## Worth knowing\n\n- Your changelog post from Monday got 3× the usual traffic from ChatGPT.\n- `docs/webhooks` is now cited in 22% of answers, up from 9%.",
    },
  ] satisfies ArtifactBlock[],
};

export interface IteratePost {
  title: string;
  description: string;
  path: string;
  /** Paragraph-level blocks; a revision marks which ones it touched. */
  blocks: string[];
}

export const ITERATE_POSTS: Record<string, IteratePost> = {
  f_webhooks: {
    title: "Webhooks now retry for 72 hours",
    description:
      "Failed deliveries back off exponentially for three days, and you can replay any of them from the dashboard.",
    path: "content/blog/webhooks-retry-72-hours.mdx",
    blocks: [
      "When your endpoint is down, a webhook used to be gone after five quick retries. That's fine for a blip and useless for a deploy that goes wrong at 2 a.m.",
      "## What changed",
      "Failed deliveries now retry with exponential backoff for up to **72 hours**: after 30 seconds, then 2 minutes, 10 minutes, an hour, and every few hours after that. Each attempt carries the same `webhook-id`, so handlers that dedupe on it see one event, not twelve.",
      "## Replay from the dashboard",
      "Every delivery is listed under **Webhooks → Deliveries** with its status, attempts and the response your server sent. Pick any failed ones and press **Replay**; they go out again in order.",
      "```bash\nacme webhooks replay --since 2026-11-14 --status failed\n```",
      "## Do I need to change anything?",
      "No. Retries are on for every endpoint. If you'd rather fail fast, set the retry window per endpoint in its settings.",
    ],
  },
  f_vs: {
    title: "Acme vs. Hookdeck: which webhook gateway fits a small team",
    description:
      "An honest comparison of pricing, retries, local development and lock-in for teams under twenty.",
    path: "content/blog/acme-vs-hookdeck.mdx",
    blocks: [
      "Hookdeck and Acme both sit between webhook senders and your code. They overlap a lot; where they differ matters most when you're small.",
      "## Pricing",
      "Hookdeck charges per event after its free tier. Acme charges per endpoint, so a burst of traffic doesn't change your bill.",
      "## Retries and replay",
      "Both retry failed deliveries. Acme retries for up to 72 hours and lets you replay from the dashboard or the CLI.",
      "## Local development",
      "Acme's CLI forwards live events to `localhost` with one command. Hookdeck has a similar CLI.",
      "## When to pick which",
      "Pick Hookdeck if you need its transformation rules. Pick Acme if you want flat pricing and long retries without setup.",
    ],
  },
  f_idempotency: {
    title: "How to make webhook handlers idempotent",
    description:
      "Store the event id, check it in the same transaction, and webhooks that arrive twice stop doing things twice.",
    path: "content/blog/idempotent-webhook-handlers.mdx",
    blocks: [
      "Every webhook provider delivers at least once. Sometimes that means twice, and your handler has to survive it.",
      "## Dedupe on the event id",
      "Save each event's id before you act on it, in the same transaction as the work. A second delivery finds the id and returns `200` without doing anything.",
      "```ts\nawait db.transaction(async (tx) => {\n  const seen = await tx.insert(events).values({ id }).onConflictDoNothing();\n  if (seen.rowCount === 0) return;\n  await fulfil(order, tx);\n});\n```",
      "## Make the work itself safe to repeat",
      "Where you can, prefer upserts over inserts and set values instead of incrementing them.",
    ],
  },
};

export interface IterateRevision {
  /** What the person asked, when the playground sends it on their behalf. */
  title?: string;
  /** Replacement blocks by index; `null` removes the block. */
  replace: Record<number, string | null>;
  /** Blocks inserted after an index. */
  insertAfter?: Record<number, string[]>;
  note: string;
}

/**
 * Scripted answers to whatever is asked, in order. Good enough to judge how
 * a revision lands on the page; the real thing would run the mention agent.
 */
export const ITERATE_REVISIONS: Record<string, IterateRevision[]> = {
  f_webhooks: [
    {
      replace: {
        0: "A webhook used to give up after five quick retries. Fine for a blip, useless when a deploy breaks at 2 a.m. and nobody notices until morning.",
        2: "Failed deliveries now retry for up to **72 hours**, backing off from 30 seconds to a few hours between attempts. Every attempt keeps the same `webhook-id`, so a handler that dedupes on it sees one event.",
      },
      note: "Tightened the intro and the retry paragraph.",
    },
    {
      title: "Your webhooks now survive a bad night",
      replace: {},
      insertAfter: {
        2: [
          "| Attempt | Waits |\n| --- | --- |\n| 1 | 30 s |\n| 2 | 2 min |\n| 3 | 10 min |\n| 4 | 1 h |\n| 5+ | every 4 h, up to 72 h |",
        ],
      },
      note: "New title, added the retry schedule as a table.",
    },
    {
      replace: {
        // The table the revision before adds moves this paragraph to 8.
        8: "No. Retries are on for every endpoint. To fail fast instead, set **Retry window** to `0` in the endpoint's settings, or pass `retryWindow: 0` when you create it through the API.",
      },
      note: "The last section now says how to turn retries off.",
    },
  ],
  f_idea: [
    {
      replace: {
        0: "A signature mismatch is almost never a forged request. The bytes you hashed aren't the bytes we signed, and that's fixable in minutes.",
      },
      note: "Friendlier opening line.",
    },
  ],
  f_vs: [
    {
      replace: {
        2: "Hookdeck charges per event after 100k a month. Acme charges **$9 per endpoint**, so a traffic spike doesn't change your bill. For a team with 5 endpoints and 2M events, that's $45 against roughly $150.",
      },
      note: "Pricing now has real numbers.",
    },
    {
      replace: {
        8: "Pick **Hookdeck** if you need transformations or routing rules between services. Pick **Acme** if you want flat pricing, 72-hour retries and replay without configuring anything.",
      },
      note: "Clearer recommendation at the end.",
    },
  ],
  f_idempotency: [
    {
      replace: {
        0: "Webhooks arrive at least once. Sometimes twice. If a duplicate charges a card twice, that's your bug, not the sender's.",
      },
      insertAfter: {
        5: [
          "## Test it",
          "Send the same event twice in a test and assert the side effect ran once. With the Acme CLI: `acme webhooks resend evt_123 --times 2`.",
        ],
      },
      note: "Punchier intro and a section on testing it.",
    },
  ],
};

export interface IterateIdeaPlan {
  /** The angle the writer takes. */
  angle: string;
  /** Sections the draft will have, in order. */
  outline: string[];
  /** What the pull request is called once the draft exists. */
  pullRequestNumber: number;
}

/** What Autopilot would write for an idea, shown before you say "write it". */
export const ITERATE_IDEA_PLANS: Record<string, IterateIdeaPlan> = {
  f_idea: {
    angle:
      "A debugging checklist for the three reasons signatures fail, in the order people hit them.",
    outline: [
      "Why a valid webhook fails verification",
      "Check the raw body first",
      "Clock drift and the timestamp window",
      "Rotated or mixed-up secrets",
      "Test it before you ship",
    ],
    pullRequestNumber: 418,
  },
};

/** The first draft an idea turns into when it's written. */
export const ITERATE_DRAFTS: Record<string, IteratePost> = {
  f_idea: {
    title: "Debugging webhook signature mismatches",
    description:
      "Your signature check fails on a webhook you know is real. Here are the three causes, in the order to check them.",
    path: "content/blog/webhook-signature-mismatch.mdx",
    blocks: [
      "A signature mismatch almost never means someone forged a request. It means the bytes you hashed aren't the bytes we signed.",
      "## Check the raw body first",
      "Most frameworks parse JSON before your handler runs. Verify against the raw request body, before any parsing or re-serialising, or the hash changes.",
      "```ts\nconst raw = await request.text();\nacme.webhooks.verify(raw, request.headers);\n```",
      "## Clock drift and the timestamp window",
      "Each delivery carries a `webhook-timestamp`. If your server's clock is more than five minutes off, verification fails on purpose to stop replays. Sync with NTP.",
      "## Rotated or mixed-up secrets",
      "Each endpoint has its own secret, and test and live mode differ. After a rotation, both secrets are valid for 24 hours, so deploy the new one inside that window.",
      "## Test it before you ship",
      "Send a signed test event from **Webhooks → Endpoints → Send test** and check your logs for the computed and expected signatures side by side.",
    ],
  },
};

export interface IteratePlanRevision {
  angle?: string;
  outline: string[];
  note: string;
}

/** Scripted answers to plan changes, in order; the real thing re-plans. */
export const ITERATE_PLAN_REVISIONS: Record<string, IteratePlanRevision[]> = {
  f_idea: [
    {
      outline: [
        "Why a valid webhook fails verification, with the error people see",
        "Check the raw body first: frameworks parse JSON before your handler",
        "Clock drift: the five-minute timestamp window and how to sync",
        "Rotated or mixed-up secrets: test vs live, the 24-hour overlap",
        "Test it before you ship: send a signed event and compare signatures",
        "A copy-paste checklist to keep next to your handler",
      ],
      note: "Each section says what it covers; added a closing checklist.",
    },
    {
      angle:
        "A story-led fix: one real 2 a.m. outage, traced back to a parsed body, then the checklist that prevents it.",
      outline: [
        "The outage: webhooks failing at 2 a.m.",
        "Tracing it to a parsed body",
        "Clock drift and rotated secrets, the other two suspects",
        "The checklist we use now",
      ],
      note: "New angle around a real incident, four sections.",
    },
  ],
};
