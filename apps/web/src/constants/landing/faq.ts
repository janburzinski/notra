import type { FaqContent } from "@/types/landing/faq";

export const FAQ_CONTENT: FaqContent = {
  heading: "Common questions",
  subcopy: "Short answers to what comes up most.",
  items: [
    {
      id: "what-is-geo",
      question: "What is GEO?",
      answer:
        "GEO stands for Generative Engine Optimization. It means getting your brand into the answer when someone asks ChatGPT, Claude, Gemini or Perplexity what to buy. Notra measures where you appear in those answers and shows you how to improve it.",
      defaultOpen: true,
    },
    {
      id: "engines",
      question: "Which engines and models do you scan?",
      answer:
        "ChatGPT, Gemini, Microsoft Copilot, Google AI Overviews and Google AI Mode, captured from the apps themselves so you see the answers people actually get, plus Claude, Grok, Kimi, GLM and DeepSeek answering from what they learned in training. You pick which ones run.",
      defaultOpen: false,
    },
    {
      id: "answers-tracked",
      question: "What counts as an AI answer tracked?",
      answer:
        "One prompt asked to one engine in one language on one scan. Ten prompts across five engines in two languages, scanned every 48 hours, is about 1,500 answers a month.",
      defaultOpen: false,
    },
    {
      id: "traffic",
      question: "How does traffic tracking work? Do I need a script tag?",
      answer:
        "You don't need one. Add @usenotra/sdk as a proxy or middleware in your Next.js, Nuxt, TanStack Start, Astro or SvelteKit site. It posts a small request envelope to Notra, we do the matching on our side and anything human is dropped before it is stored.",
      defaultOpen: false,
    },
    {
      id: "citation",
      question: "Is a crawler fetch the same as a citation?",
      answer:
        "No. Cited in answer means an assistant fetched the page while it was answering someone. Training crawlers and indexers get their own labels, and a Referral is a real person clicking through from an AI answer. Notra reports each one separately.",
      defaultOpen: false,
    },
    {
      id: "write",
      question: "Can Notra write the content too?",
      answer:
        "Yes. Pick a gap, choose guide, listicle or comparison and Write plans a brief from your brand identity, your sitemap and the competitors you track. You approve the brief, the draft opens in Content.",
      defaultOpen: false,
    },
  ],
};
