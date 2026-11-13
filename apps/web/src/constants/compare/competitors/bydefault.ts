import type { CompareCompetitor } from "@/types/compare";

export const BYDEFAULT: CompareCompetitor = {
  slug: "bydefault",
  name: "ByDefault",
  website: "https://www.bydefault.so",
  logo: { src: "/logos/competitors/bydefault.svg", width: 22, height: 22 },
  summary:
    "Developer-friendly GEO tool with daily runs, coding agent tracking, crawler logs and a content agent.",
  headline: "AI visibility, web and MCP analytics in one tool.",
  headlineAccent: "web and MCP analytics",
  heroSubtitle:
    "ByDefault runs your prompts daily on four engines and only logs AI bots. Notra adds web analytics for human visitors, MCP server analytics and AI referral tracking, and counts a citation only when an answer cites you.",
  metaDescription:
    "Notra vs ByDefault compared: engines per plan, AI traffic, web and MCP analytics, crawler logs, content and pricing for AI visibility and GEO.",
  chooseNotra: [
    "You want web analytics for human visitors next to your AI traffic",
    "You want to see which agents call your MCP server and which tools they use",
    "You want AI referral clicks and the conversions they bring",
    "You want citations counted only from real answers",
    "You want Copilot, AI Mode, Grok and DeepSeek tracked on every plan",
    "You want buyer personas, multi-turn conversations and LinkedIn and X posts",
  ],
  chooseCompetitor: [
    "You want coding agents like Cursor, Codex and Claude Code tracked",
    "You want an MCP server on the entry plan that also drafts and publishes articles",
    "You want search volume next to every content gap",
    "You want unlimited seats on every plan",
  ],
  advantages: [
    {
      title: "Web, AI and MCP analytics",
      description:
        "ByDefault only logs requests from AI tools, with no human visitors, referrals or conversions. Notra counts every visitor with a cookie-free script, shows who arrived from an AI answer and what they did next, and tracks which agents call your MCP server, which tools they use and where calls fail.",
    },
    {
      title: "Citations from real answers",
      description:
        "When Meta's crawler fetches the same page ten times to train a model, Notra logs ten training crawls and zero citations. It counts a citation only when an engine cites your page in an answer, and labels training crawls separately.",
    },
    {
      title: "More assistants on every plan",
      description:
        "ByDefault plans pick 4 of 8 engines, half of them coding agents. Notra scans ChatGPT, Claude, Gemini, Copilot, Google AI Overviews, AI Mode, Grok, Kimi, GLM and DeepSeek on every plan.",
    },
    {
      title: "Personas, conversations and social",
      description:
        "Notra asks as generated buyer personas, replays multi-turn conversations and writes unlimited LinkedIn and X posts alongside 10 long-form posts a month.",
    },
  ],
  strengths: [
    {
      title: "Coding agents tracked",
      description:
        "Cursor, Codex, Claude Code and OpenCode sit next to ChatGPT, Claude, Gemini and AI Overviews in the engine menu.",
    },
    {
      title: "Every prompt, every day",
      description:
        "Each plan's answer pool covers a daily run of every included prompt, with unlimited seats.",
    },
    {
      title: "Content agent and MCP",
      description:
        "Articles on every plan with live fact checks and a tone pass, published by commit or pull request, plus an MCP server that reads and writes your data.",
    },
  ],
  values: {
    chatgpt: true,
    claude: true,
    gemini: true,
    perplexity: false,
    aiOverviews: true,
    copilot: false,
    otherEngines: false,
    codingAgents: true,
    modelChoice: false,
    entryEngines: "4 of 8",
    collection: "Real browser sessions",
    shareOfVoice: true,
    sentiment: true,
    citations: "Crawler fetches",
    fanout: true,
    rawAnswers: true,
    personas: "Not listed",
    conversations: "Not listed",
    languages: "Not listed",
    frequency: "Daily",
    promptVolume: "Search volume",
    prompts: "50 to 350",
    crawlerLogs: true,
    referrals: false,
    conversions: false,
    webAnalytics: false,
    mcpAnalytics: "Not listed",
    siteAudit: "Not listed",
    gaps: true,
    contentWriting: true,
    socialPosts: false,
    rescan: "Not listed",
    githubPrs: true,
    commerce: false,
    api: "Articles only",
    mcp: true,
    soc2: false,
    startingPrice: "$99/mo",
  },
  plans: [
    {
      name: "Starter",
      price: "$99/mo",
      detail: "50 prompts, 4 models, 6,000 answers, 2 articles.",
    },
    {
      name: "Growth",
      price: "$249/mo",
      detail: "150 prompts, 4 models, 18,000 answers, 10 articles, 2 projects.",
    },
    {
      name: "Scale",
      price: "$599/mo",
      detail: "350 prompts, 4 models, 42,000 answers, 20 articles, 5 projects.",
    },
  ],
  pricingNote:
    "No free plan or trial. Tracking pauses when the monthly answer pool runs out.",
  faqs: [
    {
      question: "Is Notra a ByDefault alternative?",
      answer:
        "Yes. Both track AI answers, log crawlers and write content. Notra adds web analytics for human visitors, MCP server analytics, AI referral tracking, personas and conversations.",
    },
    {
      question: "Does ByDefault track Perplexity?",
      answer:
        "No. ByDefault shows Perplexity in crawler analytics but does not track Perplexity answers. Notra does not track Perplexity answers either, and logs Perplexity crawls and referral clicks.",
    },
    {
      question: "How does Notra count citations differently from ByDefault?",
      answer:
        "ByDefault counts AI crawler fetches of your pages. Notra counts a citation only when an engine cites your page in an actual answer. A training crawler like Meta's can fetch one page ten times, which Notra logs as ten training crawls and zero citations.",
    },
    {
      question: "Which is cheaper, ByDefault or Notra?",
      answer:
        "ByDefault starts at $99 and Notra at $100, and both include 6,000 answers. Notra includes every engine it offers, no prompt cap, 10 long-form posts, unlimited social posts and web and MCP server analytics.",
    },
    {
      question: "Does ByDefault have web or MCP analytics?",
      answer:
        "No. ByDefault logs requests from AI tools only. Notra also counts human visitors, AI referral clicks and conversions, and shows which agents connect to your MCP server and which tools they call.",
    },
  ],
};
