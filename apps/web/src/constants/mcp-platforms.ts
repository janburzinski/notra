import type {
  McpPlatform,
  McpPlatformStep,
  McpPlatformVariant,
  McpPlatformVariantId,
} from "@/types/mcp-platforms";
import { mcpPlatformScreenshot as screenshot } from "@/utils/mcp-platforms";
import { MCP_URL } from "@/utils/urls";

export const MCP_PLATFORM_VISITOR_COOKIE = "notra_vid";

export const MCP_PLATFORM_CONTROL_VARIANT: McpPlatformVariantId = "geo";

export const MCP_PLATFORM_PROMPT_COPIED_EVENT = "mcp_platform_prompt_copied";

export const MCP_PLATFORM_VARIANTS: Record<
  McpPlatformVariantId,
  McpPlatformVariant
> = {
  geo: {
    role: "GEO expert",
    subhead:
      "Connect Notra's MCP server and it checks how ChatGPT, Claude, Gemini and Perplexity talk about you, finds the prompts you're missing and plans the fix.",
    prompts: {
      chat: "Use Notra to check how ChatGPT, Claude, Gemini and Perplexity talk about my brand. Pull my GEO snapshot, list the prompts where competitors get cited instead of us and tell me the three fixes that would move our AI visibility most this month.",
      builder:
        "Use the Notra MCP to run an agent readiness scan on this site and pull my GEO snapshot. Then fix what you can right here in the project: add an llms.txt, structured data and clear answers on the pages AI assistants should cite.",
    },
  },
  growth: {
    role: "growth marketer",
    subhead:
      "Connect Notra's MCP server and it turns what you shipped into posts, finds where AI assistants recommend competitors and drafts the content that wins those answers back.",
    prompts: {
      chat: "You're my growth marketer. Use Notra to see what we shipped on GitHub this week, find the content gaps where AI assistants cite competitors and draft one post in our brand voice that closes the biggest gap. Save it in Notra as a draft for me to review.",
      builder:
        "Use Notra to find the content gaps where AI assistants recommend competitors instead of us. Pick the biggest one and build a page for it in this project, written in our brand voice from Notra.",
    },
  },
  aeo: {
    role: "AEO specialist",
    subhead:
      "Connect Notra's MCP server and it finds the questions AI assistants answer about your category, checks whether you're the answer and writes the content that makes you one.",
    prompts: {
      chat: "Act as my AEO specialist. Use Notra to find the questions in our category where ChatGPT, Claude or Perplexity answer without mentioning us, show me the sources they cite instead and draft a direct, quotable answer for the top three. Save the drafts in Notra.",
      builder:
        "Use Notra to find the questions AI assistants answer about our category without citing us. Add an FAQ section to this site that answers the top five in plain, quotable sentences, with FAQPage structured data.",
    },
  },
  seo: {
    role: "SEO lead",
    subhead:
      "Connect Notra's MCP server and it tracks the questions people ask AI search about your category, shows which pages get cited and plans the content that ranks in both.",
    prompts: {
      chat: "Act as my SEO lead. Use Notra to find the questions people ask AI search about our category, show which sources get cited for them and plan a content brief for the gap with the most potential. Show me the brief before you approve it.",
      builder:
        "Use Notra to list the prompts and competitors we track, then build a comparison page in this app for the competitor that wins most often. Use the sources Notra shows as cited to keep every claim on the page factual.",
    },
  },
};

const SIGN_IN_STEP: McpPlatformStep = {
  title: "Sign in to Notra",
  body: "You're sent to Notra to sign in. Pick the workspace to connect and an access level of Read only, Write only or Full access. The connection refreshes itself, so you only do this once.",
};

export const MCP_PLATFORMS: McpPlatform[] = [
  {
    id: "chatgpt",
    requirements:
      "A ChatGPT account that can install plugins and a Notra workspace.",
    name: "ChatGPT",
    kind: "chat",
    iconSrc: "/mcp/chatgpt.svg",
    invertInDark: true,
    description:
      "Install the official Notra plugin in ChatGPT, no connector URL or API key needed.",
    listing: {
      label: "Install in ChatGPT",
      href: "https://chatgpt.com/plugins/plugin_asdk_app_6ad054bf08248191a320ed1334e3ffde",
    },
    steps: [
      {
        title: "Open Notra's plugin page",
        body: "Open the Notra plugin in ChatGPT and click Install plugin.",
        screenshot: screenshot(
          "chatgpt",
          1,
          "Notra's plugin page in ChatGPT with its description, starter prompts and Install plugin button."
        ),
      },
      SIGN_IN_STEP,
      {
        title: "Ask ChatGPT",
        body: "Paste the prompt below into a new chat. ChatGPT calls the Notra tools and saves every draft in Notra for you to review.",
      },
    ],
  },
  {
    id: "claude",
    requirements: "A Claude account on any plan and a Notra workspace.",
    name: "Claude",
    kind: "chat",
    iconSrc: "/mcp/claude.svg",
    invertInDark: false,
    description:
      "Add the verified Notra connector from the Claude directory, no server URL or API key needed.",
    listing: {
      label: "Add to Claude",
      href: "https://claude.ai/directory/notra",
    },
    commands: [
      {
        id: "claude-code",
        label: "Claude Code",
        iconSrc: "/mcp/claude-code.svg",
        invertInDark: false,
        copyLabel: "Copy command",
        command: `claude mcp add --transport http notra ${MCP_URL}`,
      },
    ],
    steps: [
      {
        title: "Open Notra in the Claude directory",
        body: "Open the Notra listing in the Claude connector directory and add the connector. If you are signed out, click Sign in to add first.",
        screenshot: screenshot(
          "claude",
          1,
          "Notra's listing in the Claude connector directory with the verified badge, its tools and the connector URL."
        ),
      },
      SIGN_IN_STEP,
      {
        title: "Ask Claude",
        body: "Paste the prompt below into a new chat. Claude Code connects to the same server with claude mcp add --transport http notra followed by the server URL.",
      },
    ],
  },
  {
    id: "gemini",
    commands: [
      {
        id: "gemini-cli",
        label: "Gemini CLI",
        iconSrc: "/mcp/gemini.svg",
        invertInDark: false,
        copyLabel: "Copy command",
        command: `gemini mcp add --transport http --scope user notra ${MCP_URL}`,
      },
    ],
    requirements:
      "A personal Google account in the US with Gemini set to English, and a Notra workspace.",
    name: "Gemini",
    kind: "chat",
    iconSrc: "/mcp/gemini.svg",
    invertInDark: false,
    description:
      "Add Notra to Gemini as a custom app. It works on the web and in the Gemini mobile app.",
    steps: [
      {
        title: "Open Connected Apps",
        body: "In Gemini on the web, open Settings, then Connected Apps. Under Custom apps, click Add a custom app. Custom apps need a personal Google account in the US with Gemini set to English.",
      },
      {
        title: "Paste the Notra server URL",
        body: `Paste ${MCP_URL} as the MCP server URL and click Next.`,
      },
      SIGN_IN_STEP,
      {
        title: "Ask Gemini",
        body: "Type @ in a new chat, pick Notra and paste the prompt below. Using the Gemini CLI instead? Run gemini mcp add --transport http notra followed by the server URL.",
      },
    ],
  },
  {
    id: "grok",
    requirements:
      "A Grok account and a Notra workspace. On Grok Business, a team admin adds the connector first.",
    name: "Grok",
    kind: "chat",
    iconSrc: "/mcp/grok.svg",
    invertInDark: true,
    description:
      "Add Notra to Grok as a custom connector and let it work with your Notra workspace.",
    steps: [
      {
        title: "Open Connect Apps",
        body: "In Grok, open Settings and choose Connect Apps, or go straight to grok.com/connectors. Scroll to the bottom and click Add a custom connector.",
        screenshot: screenshot(
          "grok",
          1,
          "Grok's Connect Apps settings with the Add a custom connector button at the bottom."
        ),
      },
      {
        title: "Paste the Notra server URL",
        body: `Enter notra as the name, paste ${MCP_URL} as the server URL, leave Headers empty and click Add MCP. On Grok Business, a team admin adds it once in the xAI console under Grok Business, Connectors.`,
        screenshot: screenshot(
          "grok",
          2,
          "Grok's Add MCP Server form with notra as the name and the Notra server URL filled in."
        ),
      },
      SIGN_IN_STEP,
      {
        title: "Ask Grok",
        body: "Turn the Notra connector on in a new chat and paste the prompt below.",
      },
    ],
  },
  {
    id: "lovable",
    requirements:
      "A Lovable account where custom connectors are allowed, and a Notra workspace.",
    name: "Lovable",
    kind: "builder",
    iconSrc: "/mcp/lovable.svg",
    invertInDark: false,
    description:
      "Connect Notra to Lovable as a custom MCP server, so it can build pages from your AI visibility data.",
    steps: [
      {
        title: "Add a custom connector",
        body: "In Lovable, open Connectors, click Add custom and choose MCP server.",
      },
      {
        title: "Paste the Notra server URL",
        body: `Name it Notra, paste ${MCP_URL} as the server URL, keep OAuth selected and click Add & authorize.`,
      },
      SIGN_IN_STEP,
      {
        title: "Ask Lovable",
        body: "Open the project you want to improve and paste the prompt below. Notra is only used while Lovable builds, never by your published app.",
      },
    ],
  },
  {
    id: "v0",
    requirements: "A v0 account and a Notra workspace.",
    name: "v0",
    kind: "builder",
    iconSrc: "/mcp/v0.svg",
    invertInDark: true,
    description:
      "Connect Notra to v0 as a custom MCP server, so it can build pages from your AI visibility data.",
    steps: [
      {
        title: "Open MCPs in the prompt form",
        body: "In v0, open the + menu in the prompt form, choose MCPs and add a custom server.",
      },
      {
        title: "Paste the Notra server URL",
        body: `Name it Notra, paste ${MCP_URL} as the URL and pick OAuth as the authentication.`,
      },
      SIGN_IN_STEP,
      {
        title: "Ask v0",
        body: "Open the chat for your site and paste the prompt below. Notra is only used while v0 generates, never by the app it builds.",
      },
    ],
  },
  {
    id: "bolt",
    requirements: "A Bolt account and a Notra workspace.",
    name: "Bolt",
    kind: "builder",
    iconSrc: "/mcp/bolt.svg",
    invertInDark: true,
    wideIcon: true,
    description:
      "Connect Notra to Bolt as a custom MCP connector, so it can build pages from your AI visibility data.",
    steps: [
      {
        title: "Open Connectors",
        body: "On the Bolt homepage, click + in the chatbox, then Connectors and Manage connectors. Click Custom MCP server.",
      },
      {
        title: "Paste the Notra server URL",
        body: `Name it Notra, paste ${MCP_URL} as the URL, keep the HTTP transport, choose MCP OAuth and click Connect.`,
      },
      SIGN_IN_STEP,
      {
        title: "Ask Bolt",
        body: "Turn Notra on for your project from + and Connectors, then paste the prompt below.",
      },
    ],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    kind: "builder",
    iconSrc: "/mcp/claude-code.svg",
    invertInDark: false,
    requirements: "Claude Code installed and a Notra workspace.",
    description:
      "Add Notra to Claude Code with one command, so it can fix your site with your AI visibility data in the repo you're already in.",
    commands: [
      {
        id: "claude-code",
        label: "Claude Code",
        iconSrc: "/mcp/claude-code.svg",
        invertInDark: false,
        copyLabel: "Copy command",
        command: `claude mcp add --transport http notra ${MCP_URL}`,
      },
    ],
    steps: [
      {
        title: "Add the Notra server",
        body: "Run this in your terminal. Add --scope user to use Notra in every project.",
        code: `claude mcp add --transport http notra ${MCP_URL}`,
      },
      {
        title: "Sign in to Notra",
        body: "Start Claude Code, run /mcp, pick notra and choose Authenticate. A browser opens where you pick the workspace and access level. You can also run claude mcp login notra from your shell.",
        code: "/mcp",
      },
      {
        title: "Ask Claude Code",
        body: "Open the repo for your site and paste the prompt below.",
      },
    ],
  },
  {
    id: "codex",
    name: "Codex",
    kind: "builder",
    iconSrc: "/mcp/codex.svg",
    invertInDark: true,
    requirements:
      "The Codex CLI, IDE extension or desktop app and a Notra workspace.",
    description:
      "Add Notra to Codex once and use it in the CLI, the IDE extension and the desktop app, which share one config.",
    commands: [
      {
        id: "codex",
        label: "Codex",
        iconSrc: "/mcp/codex.svg",
        invertInDark: true,
        copyLabel: "Copy command",
        command: `codex mcp add notra --url ${MCP_URL}`,
      },
    ],
    steps: [
      {
        title: "Add the Notra server",
        body: "Run this in your terminal. It adds a notra entry to ~/.codex/config.toml. In the IDE extension, you can instead open the gear menu, choose MCP servers and add a Streamable HTTP server with the same URL.",
        code: `codex mcp add notra --url ${MCP_URL}`,
      },
      {
        title: "Sign in to Notra",
        body: "Run the login command and finish in the browser. On a machine without a browser, add --no-browser and paste the redirect URL back.",
        code: "codex mcp login notra",
      },
      {
        title: "Ask Codex",
        body: "Open the repo for your site and paste the prompt below.",
      },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    kind: "builder",
    iconSrc: "/mcp/cursor.svg",
    invertInDark: true,
    requirements: "Cursor and a Notra workspace.",
    description:
      "Add Notra to Cursor's MCP config, so the agent can work on your site with your AI visibility data.",
    commands: [
      {
        id: "cursor",
        label: "Cursor",
        iconSrc: "/mcp/cursor.svg",
        invertInDark: true,
        copyLabel: "Copy command",
        command: `npx add-mcp ${MCP_URL}`,
      },
    ],
    steps: [
      {
        title: "Add Notra to mcp.json",
        body: "Open Customize in Cursor's sidebar and go to MCP, or edit ~/.cursor/mcp.json directly. Use .cursor/mcp.json in a repo to share it with your team.",
        code: `{\n  "mcpServers": {\n    "notra": { "url": "${MCP_URL}" }\n  }\n}`,
      },
      {
        title: "Sign in to Notra",
        body: "Cursor shows that notra needs a login. Click it to open Notra in the browser, pick the workspace and access level, and Cursor stores the token.",
      },
      {
        title: "Ask Cursor",
        body: "Open the agent in your site's repo and paste the prompt below.",
      },
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    kind: "builder",
    iconSrc: "/mcp/windsurf.svg",
    invertInDark: true,
    requirements:
      "Windsurf (now Devin Desktop) with MCP allowed by your team, and a Notra workspace.",
    description:
      "Add Notra to Windsurf's Cascade agent, now part of Devin Desktop, with one entry in its MCP config.",
    steps: [
      {
        title: "Open the MCP config",
        body: "In the Cascade panel, open MCPs and choose Open MCP config file. The file lives at ~/.config/devin/mcp_config.json.",
      },
      {
        title: "Add the Notra server",
        body: "Add a notra entry with the server URL and save the file.",
        code: `{\n  "mcpServers": {\n    "notra": { "serverUrl": "${MCP_URL}" }\n  }\n}`,
      },
      {
        title: "Sign in to Notra",
        body: "Click Authenticate next to notra in the MCPs list and finish in the browser. From the Devin CLI, run devin mcp login notra.",
      },
      {
        title: "Ask Cascade",
        body: "Open your site's repo and paste the prompt below.",
      },
    ],
  },
  {
    id: "vscode",
    name: "VS Code",
    kind: "builder",
    iconSrc: "/mcp/vscode.svg",
    invertInDark: false,
    requirements:
      "VS Code with GitHub Copilot agent mode and a Notra workspace.",
    description:
      "Add Notra to GitHub Copilot in VS Code, so agent mode can work on your site with your AI visibility data.",
    commands: [
      {
        id: "vscode",
        label: "VS Code",
        iconSrc: "/mcp/vscode.svg",
        invertInDark: false,
        copyLabel: "Copy command",
        command: `code --add-mcp '{"name":"notra","type":"http","url":"${MCP_URL}"}'`,
      },
    ],
    steps: [
      {
        title: "Add the Notra server",
        body: "Open the Command Palette, run MCP: Add Server, choose HTTP and paste the server URL. Enter notra as the ID and pick Global to use it in every workspace. Or run the command below.",
        code: `code --add-mcp '{"name":"notra","type":"http","url":"${MCP_URL}"}'`,
      },
      {
        title: "Sign in to Notra",
        body: "The first time Copilot connects, VS Code opens Notra in the browser. Pick the workspace and access level and allow the connection.",
      },
      {
        title: "Ask Copilot",
        body: "Switch Copilot Chat to agent mode in your site's repo and paste the prompt below.",
      },
    ],
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    kind: "chat",
    iconSrc: "/mcp/openclaw.svg",
    invertInDark: false,
    requirements: "OpenClaw with the mcporter skill and a Notra workspace.",
    description:
      "Give your OpenClaw agent Notra's tools through mcporter, so it can check your AI visibility from any chat it runs in.",
    commands: [
      {
        id: "openclaw",
        label: "OpenClaw",
        iconSrc: "/mcp/openclaw.svg",
        invertInDark: false,
        copyLabel: "Copy command",
        command: `mcporter config add notra ${MCP_URL} --scope home`,
      },
    ],
    steps: [
      {
        title: "Add the Notra server",
        body: "Run this where OpenClaw runs. --scope home writes ~/.mcporter/mcporter.json, so every project can use it.",
        code: `mcporter config add notra ${MCP_URL} --scope home`,
      },
      {
        title: "Sign in to Notra",
        body: "Run the auth command and finish in the browser. Add --no-browser on a headless machine. The token is stored in ~/.mcporter/credentials.json.",
        code: "mcporter auth notra",
      },
      {
        title: "Ask OpenClaw",
        body: "Message your agent on any channel it listens to and paste the prompt below.",
      },
    ],
  },
  {
    id: "hermes",
    name: "Hermes",
    kind: "chat",
    iconSrc: "/mcp/hermes.svg",
    invertInDark: true,
    requirements: "Hermes Agent from Nous Research and a Notra workspace.",
    description:
      "Add Notra to Hermes Agent's MCP config, so it can check your AI visibility and draft content on its own schedule.",
    commands: [
      {
        id: "hermes",
        label: "Hermes",
        iconSrc: "/mcp/hermes.svg",
        invertInDark: true,
        copyLabel: "Copy command",
        command: `hermes mcp add notra --url ${MCP_URL}`,
      },
    ],
    steps: [
      {
        title: "Add Notra to config.yaml",
        body: "Add a notra entry under mcp_servers in ~/.hermes/config.yaml.",
        code: `mcp_servers:\n  notra:\n    url: "${MCP_URL}"\n    auth: oauth`,
      },
      {
        title: "Sign in to Notra",
        body: "On the first connection Hermes prints an authorize link and opens the browser. Pick the workspace and access level. Run hermes mcp login notra to sign in again later.",
        code: "hermes mcp login notra",
      },
      {
        title: "Ask Hermes",
        body: "Start a session and paste the prompt below. Hermes can also run it on a schedule.",
      },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    kind: "chat",
    iconSrc: "/mcp/perplexity.svg",
    invertInDark: false,
    requirements:
      "A Perplexity account that can add custom connectors and a Notra workspace. In an organization, an admin has to allow custom connectors.",
    description:
      "Add Notra to Perplexity as a custom remote connector and ask it about your AI visibility next to its own search results.",
    steps: [
      {
        title: "Add a custom connector",
        body: "In Perplexity, open Customize, then Connectors. Click Add custom, choose Add MCP connector and pick Remote.",
      },
      {
        title: "Paste the Notra server URL",
        body: `Enter notra as the name and paste ${MCP_URL} as the MCP server URL. Under Advanced, set Authentication to OAuth, tick the acknowledgement and click Add.`,
      },
      SIGN_IN_STEP,
      {
        title: "Ask Perplexity",
        body: "Turn the Notra connector on in a new thread and paste the prompt below.",
      },
    ],
  },
  {
    id: "le-chat",
    name: "Le Chat",
    kind: "chat",
    iconSrc: "/mcp/le-chat.svg",
    invertInDark: false,
    requirements:
      "A Le Chat account with admin rights (on Free, Pro and Student the account owner is the admin) and a Notra workspace.",
    description:
      "Add Notra to Mistral's Le Chat as a custom MCP connector and work with your AI visibility data in chat.",
    steps: [
      {
        title: "Add a custom MCP connector",
        body: "In Le Chat, open Connectors, click Add Connector and switch to the Custom MCP Connector tab.",
      },
      {
        title: "Paste the Notra server URL",
        body: `Enter notra as the connector name, paste ${MCP_URL} as the server URL and click Connect. Allow pop-ups for chat.mistral.ai if the sign-in window doesn't open.`,
      },
      SIGN_IN_STEP,
      {
        title: "Ask Le Chat",
        body: "Turn the Notra connector on in a new chat and paste the prompt below.",
      },
    ],
  },
  {
    id: "raycast",
    name: "Raycast",
    kind: "chat",
    iconSrc: "/mcp/raycast.svg",
    invertInDark: false,
    requirements: "Raycast Pro on macOS or iOS and a Notra workspace.",
    description:
      "Add Notra to Raycast AI as an MCP server and ask about your AI visibility from anywhere on your Mac.",
    steps: [
      {
        title: "Install a new MCP server",
        body: "Open Raycast and run Install MCP Server, or open Manage MCP Servers and choose Install New Server.",
      },
      {
        title: "Paste the Notra server URL",
        body: `Set Transport to HTTP, enter notra as the name and ${MCP_URL} as the URL. Leave OAuth Type on Dynamic and press Command and Enter.`,
      },
      {
        title: "Sign in to Notra",
        body: "Select Sign In next to notra and finish in the browser. Notra's tools show up in Raycast AI once you're signed in.",
      },
      {
        title: "Ask Raycast AI",
        body: "Open AI Chat, mention @notra and paste the prompt below.",
      },
    ],
  },
];
