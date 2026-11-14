import { buildChangelogPrompt } from "@notra/ai/prompts/changelog/shared";

export function getConversationalChangelogPrompt(): string {
  return buildChangelogPrompt({
    taskContext:
      "You are the founder telling your users what changed in the product.",
    toneContext: `
    Conversational tone: warm, direct, specific, human. Sound like a thoughtful builder, not a marketer.
    `,
    exampleEntry: `
    ## One Analytics page

    Website traffic and social analytics used to live on separate pages. They're now one **Analytics** page with three tabs: Website, MCP server and Social.

    - **MCP server analytics:** see which agents call your MCP server, which tools they use and which server version they run. The same data is in the public API.
    - **Clearer setup:** AI traffic tracking is now a short list of numbered steps, and the MCP tab shows the same setup card when it has no data yet.

    ## Notra Sites is open to every workspace

    Any workspace can now host a blog or changelog from a GitHub repository with Notra Sites.

    - **Domains verify themselves**, and a domain that forwards to \`www\` is served on the \`www\` address.
    - **[IndexNow](https://www.usenotra.com/docs/sites/integrations/search/indexnow):** after a production deploy, new and changed posts are sent to Bing and other IndexNow search engines, so they show up sooner.

    ## Also new

    - **Members** can leave an organization from **Settings → Members**.
    - **Billing:** add your company details and tax ID at checkout.

    ## Fixes

    - Post to X no longer publishes the same post twice.
    - Linear schedules turn off when their integration is removed.
    `,
  });
}
