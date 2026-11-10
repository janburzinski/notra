import { NOTRA_AGENT_FEEDBACK_PROMPT } from "@notra/utils/constants/agent-feedback-prompt";

/** Hands the snippet to a coding agent with what it can't infer from it. */
export function trafficEmbedAgentPrompt(
  origin: string,
  snippet: string,
  allowedOrigins: string[]
): string {
  return [
    "Add the Notra AI analytics embed to this site. It shows charts such as how often AI crawlers read the site, how many visitors AI assistants send and how visible the brand is in AI answers.",
    "",
    "1. Ask me which page should show it if that isn't obvious, then paste this HTML where the charts should appear:",
    "",
    "```html",
    snippet,
    "```",
    "",
    "2. Load embed.js once per page; it keeps the iframe's height in sync with the charts. In React or other JSX, convert the attributes (`style={{ border: 0, width: \"100%\" }}`, keep `data-notra-embed` and `sandbox`) and load the script with the framework's script component instead of a raw <script> tag.",
    `3. If the site sets a Content-Security-Policy, allow ${origin} in \`frame-src\` and \`script-src\`.`,
    `4. The embed only displays on these domains: ${allowedOrigins.join(", ")}. If the site also runs elsewhere (another domain or preview deployments), tell me so I can add it in Notra. Don't proxy, copy or rebuild the charts to work around this.`,
    "",
    NOTRA_AGENT_FEEDBACK_PROMPT,
  ].join("\n");
}
