import type { CompareCompetitor } from "@/types/compare";

export const PROMPTWATCH: CompareCompetitor = {
  slug: "promptwatch",
  name: "Promptwatch",
  website: "https://promptwatch.com",
  logo: {
    src: "/logos/competitors/promptwatch.svg",
    width: 1179,
    height: 1179,
  },
  summary:
    "Full-stack AI search platform from Amsterdam with broad engine coverage, visitor analytics, crawler logs and a content agent.",
  headline: "Your prompts, on the schedule you choose.",
  headlineAccent: "schedule you choose",
  heroSubtitle:
    "Promptwatch tracks eleven answer engines and three coding agents and publishes to WordPress, Webflow and Framer. Notra has no prompt cap, lets you set your own scan schedule and includes MCP server analytics, crawler logs and content on its first plan.",
  metaDescription:
    "Notra vs Promptwatch compared: engines, scan schedule, crawler, web and MCP analytics, content, API and pricing for AI search visibility.",
  chooseNotra: [
    "You want no prompt cap instead of 50, 150 or 350 prompts",
    "You want crawler logs and content on the first paid plan",
    "You want to scan weekly or monthly to cover more prompts per dollar",
    "You want to see which agents call your MCP server and its tools",
    "You want multi-turn conversations and Grok, Kimi or GLM tracked",
  ],
  chooseCompetitor: [
    "You need Perplexity, Alexa, Mistral or coding agents tracked",
    "You want hourly scans or city-level targeting",
    "You want crawler logs from CloudFront, Fastly or Akamai",
    "You want auto-publishing to WordPress, Webflow or Framer",
  ],
  advantages: [
    {
      title: "No prompt cap",
      description:
        "Promptwatch plans cap prompts at 50, 150 or 350. Notra has no prompt cap. A single-language scan uses one AI answer per prompt and engine from your monthly budget, and extra languages, personas and conversation turns use more, so you trade prompt count against engines, settings and scan frequency.",
    },
    {
      title: "Crawler logs and content on the first plan",
      description:
        "Promptwatch Essential at $95 includes no crawler logs and no articles. Both start on Professional at $245. Notra Starter at $100 includes crawler logs, web analytics, 10 long-form posts and unlimited LinkedIn and X posts.",
    },
    {
      title: "Your scan schedule",
      description:
        "Promptwatch runs prompts daily, or up to hourly on Business. Notra lets you choose daily, weekly or monthly scans per project, so a slower schedule covers more prompts per dollar.",
    },
    {
      title: "MCP server analytics",
      description:
        "If you run an MCP server, Notra shows which agents and clients connect, which tools they call, how long each call takes and where calls fail. Promptwatch does not list this.",
    },
  ],
  strengths: [
    {
      title: "Broad engine coverage",
      description:
        "ChatGPT, AI Overviews, AI Mode, Copilot, Perplexity, Claude, Gemini, Meta AI, DeepSeek, Mistral and Alexa, plus Codex, OpenCode and Claude Code.",
    },
    {
      title: "Hourly scans and unlimited seats",
      description:
        "Unlimited team seats on every plan, scans up to every hour on Business and Local GEO pinned to an exact map location.",
    },
    {
      title: "Deep log integrations",
      description:
        "Crawler logs from Cloudflare, CloudFront, Fastly, Vercel, Netlify, Akamai, Google Cloud CDN, a WordPress plugin and a custom endpoint, plus visitor analytics from a JS tag.",
    },
    {
      title: "CMS publishing and fact checks",
      description:
        "Drafts that publish to WordPress, Webflow and Framer, plus Fact Check, Shopping Insights, Ads Radar and SSO.",
    },
  ],
  values: {
    chatgpt: true,
    claude: true,
    gemini: true,
    perplexity: true,
    aiOverviews: true,
    copilot: true,
    otherEngines: true,
    codingAgents: true,
    modelChoice: false,
    entryEngines: "All on paid plans",
    collection: "Real interfaces, APIs for some",
    shareOfVoice: true,
    sentiment: true,
    citations: true,
    fanout: true,
    rawAnswers: true,
    personas: true,
    conversations: "Not listed",
    languages: "Country, state, city",
    frequency: "Daily, up to hourly on Business",
    promptVolume: "Keyword volume",
    prompts: "50 to 350",
    crawlerLogs: "Professional plan",
    referrals: true,
    conversions: true,
    webAnalytics: true,
    mcpAnalytics: "Not listed",
    siteAudit: true,
    gaps: true,
    contentWriting: "Professional plan",
    socialPosts: false,
    rescan: "Not listed",
    githubPrs: "Not listed",
    commerce: true,
    api: true,
    mcp: true,
    soc2: "Not listed",
    startingPrice: "Free, then $95/mo",
  },
  plans: [
    {
      name: "Explore",
      price: "Free",
      detail: "10 prompts on ChatGPT only, 1 project.",
    },
    {
      name: "Essential",
      price: "$95/mo",
      detail:
        "50 prompts, 6,000 responses, unlimited seats. No crawler logs or articles.",
    },
    {
      name: "Professional",
      price: "$245/mo",
      detail:
        "150 prompts, 18,000 responses, crawler logs, 5 articles, unlimited seats.",
    },
    {
      name: "Business",
      price: "$579/mo",
      detail:
        "350 prompts, 42,000 responses, 10 articles, up to hourly scans, city targeting.",
    },
  ],
  pricingNote:
    "Annual billing gets two months free and every paid plan has a free trial. Agency plans run from $199 to $799 a month. Enterprise is custom.",
  faqs: [
    {
      question: "Is Notra a Promptwatch alternative?",
      answer:
        "Yes. Both track AI answers, log AI crawlers, count human visitors and write content. Notra adds no prompt cap, a flexible scan schedule, multi-turn conversations and MCP server analytics and includes crawler logs and content on its first plan.",
    },
    {
      question: "Do Promptwatch and Notra have web analytics?",
      answer:
        "Both do. Promptwatch counts visits from a JS tag, from 200K hits a month on Essential. Notra counts visitors with a cookie-free script on every plan and also tracks the agents that call your MCP server.",
    },
    {
      question: "Which engines does Promptwatch track that Notra does not?",
      answer:
        "Perplexity, Meta AI, Mistral, Alexa and the coding agents Codex, OpenCode and Claude Code. Notra tracks ChatGPT, Claude, Gemini, Copilot, Google AI Overviews, AI Mode, Grok, Kimi, GLM and DeepSeek.",
    },
    {
      question: "How does prompt demand data compare?",
      answer:
        "Both use search keyword data, since only the AI labs know how often a prompt is asked. Promptwatch buys keyword volume from DataForSEO. Notra uses your own Google Search Console data.",
    },
  ],
};
