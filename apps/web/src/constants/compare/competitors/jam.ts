import type { CompareCompetitor } from "@/types/compare";

export const JAM: CompareCompetitor = {
  slug: "jam",
  name: "Jam",
  website: "https://www.spreadjam.com",
  logo: { src: "/logos/competitors/jam.png", width: 112, height: 160 },
  summary:
    "Proactive AEO tool that tracks AI answers, researches gaps and ships fixes as pull requests. Usage-based pricing from $140.",
  headline: "Visibility, traffic and MCP analytics in one place.",
  headlineAccent: "MCP analytics",
  heroSubtitle:
    "Jam tracks six engines and ships fixes as pull requests on usage-based plans. Notra adds Claude, Grok and DeepSeek on every plan, AI crawler logs, web analytics and MCP server analytics.",
  metaDescription:
    "Notra vs Jam (spreadjam.com) compared: AI visibility tracking, engines, crawler, web and MCP analytics, content and pricing.",
  chooseNotra: [
    "You want to see which AI crawlers read your site",
    "You want web analytics for human visitors and AI referrals",
    "You want to see which agents call your MCP server",
    "You want Claude without a paid add-on",
    "You want LinkedIn and X posts and no prompt cap",
  ],
  chooseCompetitor: [
    "You want Perplexity tracked",
    "You want a 14-day free trial",
    "You want a usage calculator that prices prompts and scan frequency directly",
  ],
  advantages: [
    {
      title: "Crawler, web and MCP analytics",
      description:
        "Jam reads Google Search Console data. Notra logs 66 known AI agents, counts human visitors with a cookie-free script and shows which agents call your MCP server and its tools.",
    },
    {
      title: "More engines included",
      description:
        "Jam covers ChatGPT, Gemini, Perplexity, Copilot and Google AI, with Claude as a paid add-on. Notra scans ChatGPT, Claude, Gemini, Copilot, Google AI, Grok, Kimi, GLM and DeepSeek on every plan.",
    },
    {
      title: "No prompt cap",
      description:
        "Jam prices each plan by prompt count and scan frequency, from 50 to 1,000 prompts. Notra has no prompt cap. A single-language scan uses one AI answer per prompt and engine from your monthly budget, and extra languages, personas and conversation turns use more, so you trade prompt count against engines, settings and scan frequency.",
    },
  ],
  strengths: [
    {
      title: "Fixes shipped as PRs",
      description:
        "Jam researches each gap and opens pull requests with the fix, with articles drafted on credits.",
    },
    {
      title: "Perplexity and personas",
      description:
        "Six engines on every plan, including Perplexity, and every prompt tagged as a discoverer, buyer or evaluator.",
    },
    {
      title: "Free trial",
      description: "Every plan starts with a 14-day free trial.",
    },
  ],
  values: {
    chatgpt: true,
    claude: "Paid add-on",
    gemini: true,
    perplexity: true,
    aiOverviews: true,
    copilot: true,
    otherEngines: false,
    codingAgents: false,
    modelChoice: false,
    entryEngines: "6",
    collection: "Third-party collector, Claude by API",
    shareOfVoice: true,
    sentiment: false,
    citations: true,
    fanout: "Not listed",
    rawAnswers: true,
    personas: true,
    conversations: "Not listed",
    languages: "Not listed",
    frequency: "Weekly to daily",
    promptVolume: false,
    prompts: "50 to 1,000",
    crawlerLogs: false,
    referrals: "Search Console only",
    conversions: "Not listed",
    webAnalytics: false,
    mcpAnalytics: false,
    siteAudit: true,
    gaps: true,
    contentWriting: true,
    socialPosts: false,
    rescan: "Not listed",
    githubPrs: true,
    commerce: false,
    api: true,
    mcp: true,
    soc2: "In progress",
    startingPrice: "$140/mo",
  },
  plans: [
    {
      name: "Starting out",
      price: "$144/mo",
      detail: "50 prompts, weekly scans, 1,000 credits, 6 engines.",
    },
    {
      name: "Growing",
      price: "$299/mo",
      detail: "400 prompts, scans every other day, 2,000 credits.",
    },
    {
      name: "At scale",
      price: "$974/mo",
      detail: "1,000 prompts, daily scans, 5,000 credits.",
    },
    {
      name: "Enterprise",
      price: "Custom",
      detail: "More than 1,000 prompts.",
    },
  ],
  pricingNote:
    "Usage based, with a 14-day free trial. Tracking uses no credits. A researched article costs about 65 credits and Claude is a paid add-on.",
  faqs: [
    {
      question: "Is Notra a Jam alternative?",
      answer:
        "Yes. Both track AI answers and turn gaps into content and pull requests. Notra adds AI crawler logs, web analytics, MCP server analytics and plans with no prompt cap.",
    },
    {
      question: "Which engines does Jam track?",
      answer:
        "ChatGPT, Gemini, Perplexity, Copilot, Google AI Overviews and AI Mode, with Claude as a paid add-on. Notra includes Claude, Grok, Kimi, GLM and DeepSeek on every plan but does not track Perplexity.",
    },
    {
      question: "Does Jam have AI crawler logs?",
      answer:
        "We could not find crawler logs on Jam's site. It reads traffic from Google Search Console. Notra logs 66 known AI agents and AI referral clicks and counts human visitors with web analytics.",
    },
  ],
};
