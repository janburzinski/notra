import type { CompareCompetitor } from "@/types/compare";

export const SCRUNCH: CompareCompetitor = {
  slug: "scrunch",
  name: "Scrunch",
  website: "https://scrunch.com",
  logo: { src: "/logos/competitors/scrunch.svg", width: 144, height: 144 },
  summary:
    "Enterprise AI customer experience platform, now part of Sitecore. Four engines on Core, nine and an edge layer for AI bots on Enterprise.",
  headline: "Find the gap and publish the fix.",
  headlineAccent: "publish the fix",
  heroSubtitle:
    "Scrunch Core tracks four engines and saves the edge layer for AI bots for Enterprise. Notra starts at $100 with every engine it offers, writes full posts for the prompts you lose and adds web and MCP server analytics.",
  metaDescription:
    "Notra vs Scrunch compared: engines, data collection, crawler, web and MCP analytics, content and pricing for AI search visibility.",
  chooseNotra: [
    "Your budget starts closer to $100 than $250 a month",
    "You want more than 125 prompts without an Enterprise contract",
    "You want to scan daily for as long as you like",
    "You want multi-turn conversations alongside buyer personas",
    "You want web analytics for human visitors and MCP server analytics",
  ],
  chooseCompetitor: [
    "You need Perplexity or Meta AI tracked",
    "You want Agent Pages (AXP) to serve AI bots a machine-readable copy of each page",
    "You are on Sitecore or want an enterprise vendor with SOC 2 Type II",
  ],
  advantages: [
    {
      title: "More for less on the entry plan",
      description:
        "Scrunch Core is $250 a month for 125 prompts, 5,000 answers and 4 engines. Notra Starter is $100 for 6,000 answers with no prompt cap, every engine it offers and 10 long-form posts.",
    },
    {
      title: "Gaps turned into posts",
      description:
        "Scrunch Core includes basic content generation. Notra ranks gaps by opportunity, writes the brief and a full draft in your brand voice and rescans after you publish.",
    },
    {
      title: "Your scan schedule",
      description:
        "Scrunch runs new prompts daily for 14 days, then every 72 hours by default. Notra lets you keep daily scans or pick any interval up to 90 days.",
    },
  ],
  strengths: [
    {
      title: "Nine engines on Enterprise",
      description:
        "ChatGPT, Perplexity, Google AI Overviews and Copilot on Core, plus Gemini, Claude, AI Mode, Grok and Meta AI on Enterprise.",
    },
    {
      title: "Agent Experience Platform",
      description:
        "AXP, now sold as Agent Pages on Enterprise, detects AI bots at the CDN edge and serves a compressed, machine-readable page. Scrunch cites a 364% lift for Akamai on non-branded prompts.",
    },
    {
      title: "Enterprise scale",
      description:
        "SOC 2 Type II, RBAC, multi-site setups, a Data API and Looker Studio. Over 500 customers including Lenovo and Skims. Sitecore bought Scrunch in June 2026.",
    },
  ],
  values: {
    chatgpt: true,
    claude: "Enterprise",
    gemini: "Enterprise",
    perplexity: true,
    aiOverviews: true,
    copilot: true,
    otherEngines: "Grok and Meta AI on Enterprise",
    codingAgents: "Not listed",
    modelChoice: false,
    entryEngines: "4",
    collection: "Browser and APIs",
    shareOfVoice: true,
    sentiment: true,
    citations: true,
    fanout: "Limited on Core",
    rawAnswers: true,
    personas: true,
    conversations: "Not listed",
    languages: "1 on Core",
    frequency: "Every 72 hours",
    promptVolume: "Topic estimates",
    prompts: "125 on Core",
    crawlerLogs: true,
    referrals: "Via GA4",
    conversions: "Not listed",
    webAnalytics: false,
    mcpAnalytics: "Not listed",
    siteAudit: true,
    gaps: "Not listed",
    contentWriting: "Basic",
    socialPosts: false,
    rescan: "Manual refresh",
    githubPrs: "Not listed",
    commerce: "Enterprise",
    api: "Enterprise",
    mcp: "Enterprise",
    soc2: true,
    startingPrice: "$250/mo",
  },
  plans: [
    {
      name: "Core",
      price: "$250/mo",
      detail:
        "125 prompts, 5,000 answers, 4 engines, 1 persona, 5 seats, 7-day trial.",
    },
    {
      name: "Enterprise",
      price: "Custom",
      detail: "9 engines, Agent Pages, API, MCP and SSO.",
    },
  ],
  pricingNote:
    "Core covers ChatGPT, Perplexity, Google AI Overviews and Copilot. Agency plans start at $500 a month.",
  faqs: [
    {
      question: "Is Notra a Scrunch alternative?",
      answer:
        "Yes, especially for smaller teams. Scrunch is an enterprise platform from $250 a month with 4 engines. Notra starts at $100 with every engine it offers, full content writing and web and MCP server analytics.",
    },
    {
      question: "What happened to Scrunch after the Sitecore deal?",
      answer:
        "Sitecore bought Scrunch in June 2026. Scrunch still runs as its own product and will be built into SitecoreAI over time.",
    },
    {
      question: "Does Notra have something like Scrunch AXP?",
      answer:
        "No. Notra does not rewrite your pages at the edge. It logs which pages AI crawlers read and helps you write content that answers the prompts you lose.",
    },
  ],
};
