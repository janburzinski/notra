import type { CompareCompetitor } from "@/types/compare";

export const OTTERLY: CompareCompetitor = {
  slug: "otterly",
  name: "Otterly.AI",
  website: "https://otterly.ai",
  logo: { src: "/logos/competitors/otterly.png", width: 112, height: 112 },
  summary:
    "Affordable, credit-based AI search monitoring for SEO teams and agencies. Self-serve plans pick 4 of 7 engines.",
  headline: "Every engine and content writing in one plan.",
  headlineAccent: "one plan",
  heroSubtitle:
    "Otterly is a low-cost monitoring tool where you pick 4 of 7 engines on credits. Notra scans every assistant it offers on every plan, writes the content that closes your gaps and adds web and MCP server analytics.",
  metaDescription:
    "Notra vs Otterly.AI compared: engines and credits, prompts, crawler, web and MCP analytics, content and pricing for AI search monitoring.",
  chooseNotra: [
    "You want ChatGPT, Claude, Gemini, Copilot and Google AI all at once, not 4 of 7",
    "You want Notra to write the content for you",
    "You want to add prompts without a per-plan prompt cap",
    "You want personas and multi-turn conversations",
    "You want web analytics and MCP server analytics today",
  ],
  chooseCompetitor: [
    "You want to start at $29 a month",
    "You need Perplexity tracked",
    "You are an agency that wants branded Looker Studio reports and unlimited seats",
  ],
  advantages: [
    {
      title: "No engine slots",
      description:
        "Otterly self-serve plans pick 4 of 7 engines, and a Claude answer costs 3 credits. Every Notra plan scans ChatGPT, Claude, Gemini, Copilot, Google AI Overviews, AI Mode, Grok, Kimi, GLM and DeepSeek.",
    },
    {
      title: "Notra writes the post",
      description:
        "Otterly gives recommendations. Notra writes the brief and the post in your brand voice and rescans the prompt after you publish.",
    },
    {
      title: "No prompt cap",
      description:
        "Otterly plans include 16, 120 or 403 prompts. Notra has no prompt cap. A single-language scan uses one AI answer per prompt and engine from your monthly budget, and extra languages, personas and conversation turns use more, so you trade prompt count against engines, settings and scan frequency.",
    },
  ],
  strengths: [
    {
      title: "Lowest entry price",
      description:
        "Lite starts at $29 a month and annual billing saves 15%, with a free trial.",
    },
    {
      title: "Countries and languages",
      description:
        "Unlimited countries and languages, with prompts run daily or weekly on Premium.",
    },
    {
      title: "Agency friendly",
      description:
        "Unlimited seats, and agency partners get custom-branded Looker Studio reports for clients.",
    },
  ],
  values: {
    chatgpt: true,
    claude: true,
    gemini: true,
    perplexity: true,
    aiOverviews: true,
    copilot: true,
    otherEngines: false,
    codingAgents: false,
    modelChoice: false,
    entryEngines: "4 of 7",
    collection: "Real browser sessions",
    shareOfVoice: true,
    sentiment: true,
    citations: true,
    fanout: true,
    rawAnswers: "Not listed",
    personas: "Not listed",
    conversations: "Not listed",
    languages: "Unlimited",
    frequency: "Daily, weekly on Premium",
    promptVolume: "Prompt research",
    prompts: "16 to 403",
    crawlerLogs: "Standard plan",
    referrals: "Not listed",
    conversions: "Not listed",
    webAnalytics: "Coming soon",
    mcpAnalytics: false,
    siteAudit: true,
    gaps: "Recommendations",
    contentWriting: false,
    socialPosts: false,
    rescan: "Not listed",
    githubPrs: "Not listed",
    commerce: true,
    api: "Standard plan",
    mcp: "Standard plan",
    soc2: "Not listed",
    startingPrice: "$29/mo",
  },
  plans: [
    {
      name: "Lite",
      price: "$29/mo",
      detail: "16 prompts (2,000 credits), 4 of 7 engines.",
    },
    {
      name: "Standard",
      price: "$189/mo",
      detail:
        "120 prompts (15,000 credits), API and MCP, 200k agent analytics events.",
    },
    {
      name: "Premium",
      price: "$489/mo",
      detail:
        "403 prompts (50,000 credits), 1M agent analytics events, daily or weekly.",
    },
    {
      name: "Enterprise",
      price: "Custom",
      detail: "1,000+ prompts, every engine, SSO, success manager.",
    },
  ],
  pricingNote:
    "Credit based: one credit is one prompt on one engine, and Claude uses 3. Extra packs add 5,000 or 10,000 credits a month. Prices may show in EUR.",
  faqs: [
    {
      question: "Is Notra an Otterly.AI alternative?",
      answer:
        "Yes. Otterly is a strong low-cost monitor. Notra includes more engines at once, writes content and adds web and MCP server analytics, which suits teams that want to act on the data.",
    },
    {
      question: "Is Otterly cheaper than Notra?",
      answer:
        "At the entry level, yes. Lite is $29 for 16 prompts on 4 engines. Standard is $189 for 120 prompts. Notra Starter is $100 with 6,000 AI answers, no prompt cap and 10 long-form posts.",
    },
    {
      question: "Does Otterly track Copilot and Perplexity?",
      answer:
        "Both are among Otterly's 7 engines, and you pick 4 per plan. Notra tracks Copilot on every plan but does not track Perplexity.",
    },
  ],
};
