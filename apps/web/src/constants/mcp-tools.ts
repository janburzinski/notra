import type { McpToolCard } from "@/types/mcp";

/**
 * Every tool the hosted server listed on 2026-11-10, with the first sentence of its description. The
 * page shows the live list; this only fills in when that request fails or no API key is set (local dev).
 */
export const MCP_FALLBACK_TOOL_CARDS: McpToolCard[] = [
  {
    name: "list_posts",
    description:
      "List post summaries from Notra (title, status, type, short excerpt) with optional filters for sorting, pagination, status, content type, and brand identity.",
  },
  {
    name: "get_post",
    description:
      "Get a single post by its ID, including full content in HTML and markdown.",
  },
  {
    name: "get_post_agent_reach",
    description:
      "Get AI traffic to one post's live page on its Notra Site, including its Markdown copy: crawler, citation (assistants reading it while answering someone) and referral (people clicking through from an AI answer) totals, a per-source breakdown and the daily timeseries.",
  },
  {
    name: "create_post",
    description:
      "Create a post directly from your own title and markdown, without AI generation.",
  },
  {
    name: "update_post",
    description:
      "Update a post's title, slug, markdown, publication status, or credited authors.",
  },
  {
    name: "delete_post",
    description:
      "Delete a post by its ID, including content that may be published on a hosted site.",
  },
  {
    name: "generate_post",
    description: "Queue an async post generation job.",
  },
  {
    name: "create_post_pull_request",
    description:
      "Open a draft GitHub pull request for a saved blog post or changelog, using the repository's configured content path, site metadata and images, the same as the dashboard.",
  },
  {
    name: "get_post_generation_status",
    description: "Check the status of an async post generation job.",
  },
  {
    name: "get_post_schedule",
    description:
      "Get a post's publishing schedule and the state of every destination.",
  },
  {
    name: "schedule_post",
    description:
      "Schedule an existing post for publishing in Notra and optionally GitHub, X, or LinkedIn.",
  },
  {
    name: "cancel_post_schedule",
    description:
      "Cancel pending publishing destinations and clear failed ones.",
  },
  {
    name: "list_sites",
    description:
      "List the workspace's Notra Sites with their URL, whether they are live and their blog mount.",
  },
  {
    name: "list_site_authors",
    description:
      "List a Notra Site's blog authors from its blog.json, including unpublished Design changes.",
  },
  {
    name: "upsert_site_author",
    description:
      "Create a Notra Site blog author, or replace every field of an existing one (fields you leave out are removed, so send the full author).",
  },
  {
    name: "delete_site_author",
    description: "Remove an author from a Notra Site's blog.json.",
  },
  {
    name: "import_site_authors",
    description:
      "Copy the workspace's Notra authors into a Notra Site's blog.json, using each author's slug as its id; with replace, authors that already use that id are overwritten.",
  },
  {
    name: "set_site_author_page",
    description:
      "Set the layout of every author page on a Notra Site (blog.authorPage): inline or stacked.",
  },
  {
    name: "publish_site_design",
    description:
      "Publish a Notra Site's unpublished blog.json Design changes (authors, author page layout and the images they use): commits them to the site's production branch and deploys the live site, like Publish in the dashboard.",
  },
  {
    name: "get_site",
    description:
      "Get a Site's settings, live deployment, custom domains with the DNS records they need, and open previews.",
  },
  {
    name: "list_site_deployments",
    description:
      "List a Site's production and preview builds, newest first, with status, commit, error message and compiler diagnostics (file, line, message).",
  },
  {
    name: "get_site_deployment",
    description:
      "Get one Site deployment with its compiler diagnostics and the newest build log output.",
  },
  {
    name: "deploy_site",
    description: "Build the newest commit on a Site's production branch.",
  },
  {
    name: "redeploy_site_deployment",
    description:
      "Build the same commit as an existing deployment again, for example to retry a failed build.",
  },
  {
    name: "preview_post_on_site",
    description:
      "Build a private preview of a Site with a saved blog post or changelog added, without changing the repository or the live site, and return its URL.",
  },
  {
    name: "get_site_post_preview",
    description:
      "Get the status and URL of a post's preview on a Site. preview is null when there is none.",
  },
  {
    name: "publish_post_to_site",
    description:
      "Open a pull request that adds a saved blog post or changelog, with its images and frontmatter, to a Site's GitHub repository, or update the post's open pull request.",
  },
  {
    name: "list_brand_identities",
    description: "List all brand identities configured for your organization",
  },
  {
    name: "get_brand_identity",
    description:
      "Get a single brand identity by its ID, including tone, audience, and language settings",
  },
  {
    name: "update_brand_identity",
    description:
      "Update a brand identity's settings including name, tone, audience, language, and more",
  },
  {
    name: "delete_brand_identity",
    description: "Delete a brand identity.",
  },
  {
    name: "generate_brand_identity",
    description: "Queue async brand identity generation from a website URL.",
  },
  {
    name: "get_brand_identity_generation_status",
    description: "Check the status of an async brand identity generation job",
  },
  {
    name: "list_brand_colors",
    description:
      "List the brand guideline colors of a brand identity, including light/dark hex values, role, and usage",
  },
  {
    name: "create_brand_color",
    description: "Add a color to a brand identity's guidelines",
  },
  {
    name: "update_brand_color",
    description: "Update a brand color's hex values, name, role, or usage.",
  },
  {
    name: "delete_brand_color",
    description: "Delete a color from a brand identity's guidelines",
  },
  {
    name: "list_integrations",
    description:
      "List enabled GitHub and Linear integrations for your organization.",
  },
  {
    name: "list_github_activity",
    description:
      "List what shipped in a connected GitHub repository: pull requests merged into the default branch (default), commits on it, or published releases, within a time window (default: last 7 days).",
  },
  {
    name: "create_github_integration",
    description: "Connect a public GitHub repository for content generation.",
  },
  {
    name: "delete_integration",
    description: "Delete a GitHub or Linear integration.",
  },
  {
    name: "list_schedules",
    description:
      "List scheduled content generation jobs, optionally filtered by repository IDs",
  },
  {
    name: "create_schedule",
    description:
      "Create a content generation schedule using a cron-style daily, weekly, or monthly trigger.",
  },
  {
    name: "update_schedule",
    description: "Update an existing content generation schedule.",
  },
  {
    name: "delete_schedule",
    description: "Delete a content generation schedule by its ID",
  },
  {
    name: "run_schedule",
    description:
      "Run an enabled content generation schedule once right now, outside its cron timing.",
  },
  {
    name: "list_schedule_runs",
    description:
      "List a schedule's most recent runs, newest first, with status, error message and the draft post each run created (use get_post with postId)",
  },
  {
    name: "list_event_triggers",
    description:
      "List event triggers that generate content automatically from GitHub releases or pushes. repositoryMap labels each targeted GitHub integration ID with its owner/repo.",
  },
  {
    name: "get_event_trigger",
    description: "Get a single event trigger by its ID",
  },
  {
    name: "create_event_trigger",
    description:
      "Create an event trigger that generates content whenever a GitHub release or push happens in the targeted repositories.",
  },
  {
    name: "update_event_trigger",
    description: "Replace an event trigger's configuration.",
  },
  {
    name: "delete_event_trigger",
    description: "Delete an event trigger",
  },
  {
    name: "list_webhook_endpoints",
    description: "List HTTPS endpoints subscribed to Notra events.",
  },
  {
    name: "delete_webhook_endpoint",
    description:
      "Remove a webhook subscription and cancel its unsent deliveries",
  },
  {
    name: "list_webhook_deliveries",
    description: "List webhook deliveries across all endpoints, newest first.",
  },
  {
    name: "get_webhook_delivery",
    description: "Get a webhook delivery's payload and attempt history",
  },
  {
    name: "retry_webhook_delivery",
    description:
      "Queue a failed webhook delivery to be sent again, keeping its attempt history.",
  },
  {
    name: "list_skills",
    description: "List reusable writing skills for your organization",
  },
  {
    name: "get_skill",
    description: "Get a single reusable writing skill by name",
  },
  {
    name: "create_skill",
    description: "Create a reusable writing skill",
  },
  {
    name: "update_skill",
    description: "Update a reusable writing skill by name",
  },
  {
    name: "delete_skill",
    description: "Delete a reusable writing skill by name",
  },
  {
    name: "list_feedback",
    description:
      "List feedback your organization received through its feedback URL, MCP servers or SDKs, filtered by triage status, kind or project",
  },
  {
    name: "get_feedback",
    description:
      "Get a single feedback entry with its full message, agent metadata and context URL",
  },
  {
    name: "update_feedback",
    description:
      "Set the triage status of a feedback entry: new, triaged, resolved or archived",
  },
  {
    name: "list_projects",
    description: "List the organization's GEO projects.",
  },
  {
    name: "get_project",
    description: "Get a single GEO project by its ID",
  },
  {
    name: "create_project",
    description: "Create a GEO project from a brand identity's website.",
  },
  {
    name: "update_project",
    description: "Rename a GEO project or relink its brand identity",
  },
  {
    name: "delete_project",
    description:
      "Delete a GEO project and its settings, prompts, sequences, competitors, scans, checks, and reports.",
  },
  {
    name: "get_geo_settings",
    description:
      "Get a project's GEO settings: tracked company name, aliases, languages, answer engines and the recurring scan configuration",
  },
  {
    name: "list_geo_engines",
    description: "List the answer engine IDs a project can track.",
  },
  {
    name: "update_geo_settings",
    description:
      "Change a project's GEO settings and restart the recurring scan schedule.",
  },
  {
    name: "list_geo_prompts",
    description:
      "List the GEO prompts tracked for a project: custom prompts plus the ones derived automatically from the brand context",
  },
  {
    name: "create_geo_prompt",
    description:
      "Track a new GEO prompt so future scans check it against every configured answer engine",
  },
  {
    name: "update_geo_prompt",
    description: "Enable or disable a tracked GEO prompt",
  },
  {
    name: "delete_geo_prompt",
    description: "Stop tracking a GEO prompt",
  },
  {
    name: "import_geo_prompts",
    description:
      "Bulk import GEO prompts from structured rows or raw CSV text.",
  },
  {
    name: "list_geo_prompt_suggestions",
    description:
      "List prompts Notra suggests tracking, derived from the project's Google Search Console queries with their clicks, impressions and position.",
  },
  {
    name: "accept_geo_prompt_suggestion",
    description: "Start tracking a suggested prompt and return it.",
  },
  {
    name: "dismiss_geo_prompt_suggestion",
    description: "Dismiss a suggested prompt without tracking it.",
  },
  {
    name: "list_geo_sequences",
    description:
      "List a project's GEO prompt sequences (multi-turn conversations played against answer engines)",
  },
  {
    name: "create_geo_sequence",
    description:
      "Create a GEO prompt sequence: an ordered list of prompts played as one conversation",
  },
  {
    name: "update_geo_sequence",
    description: "Update a GEO prompt sequence's name, steps or enabled state",
  },
  {
    name: "delete_geo_sequence",
    description: "Delete a GEO prompt sequence",
  },
  {
    name: "run_geo_sequence",
    description: "Run a GEO prompt sequence now.",
  },
  {
    name: "list_geo_personas",
    description:
      "List a project's GEO personas: AI buyer profiles that hold multi-turn conversations with answer engines that have web search, each with its profile, memories and conversation prompts.",
  },
  {
    name: "update_geo_persona",
    description:
      "Turn a GEO persona on or off for scheduled scans, or edit its details.",
  },
  {
    name: "archive_geo_persona",
    description: "Archive and disable a GEO persona so future scans skip it.",
  },
  {
    name: "restore_geo_persona",
    description: "Restore an archived GEO persona.",
  },
  {
    name: "get_geo_persona_results",
    description:
      "Get every turn of one scan's conversations for a GEO persona, per engine: the prompt, the answer, whether the brand was mentioned, its position and the cited sources.",
  },
  {
    name: "get_geo_persona_activity",
    description:
      "Get daily checks and mentions per GEO persona and persona version.",
  },
  {
    name: "run_geo_persona",
    description: "Play a GEO persona's conversation now.",
  },
  {
    name: "generate_geo_personas",
    description: "Start AI persona generation in the background.",
  },
  {
    name: "get_geo_persona_generation_status",
    description: "Get the project's latest GEO persona generation job.",
  },
  {
    name: "list_geo_competitors",
    description:
      "List the competitors tracked for a project's GEO share-of-voice reporting",
  },
  {
    name: "upsert_geo_competitor",
    description: "Create or update a tracked GEO competitor.",
  },
  {
    name: "suggest_geo_competitors",
    description: "Discover likely competitors for a website domain using AI.",
  },
  {
    name: "delete_geo_competitor",
    description: "Stop tracking a GEO competitor.",
  },
  {
    name: "import_geo_competitors",
    description:
      "Bulk import GEO competitors from structured rows or raw CSV text.",
  },
  {
    name: "get_geo_snapshot",
    description:
      "Get a compact GEO diagnosis across visibility, sentiment, scan changes, competitors, content gaps, shelf sources, readiness and AI traffic.",
  },
  {
    name: "get_geo_changes",
    description:
      "Compare the two latest GEO scans and list gained or lost mentions, positions and citations",
  },
  {
    name: "get_geo_prompt_history",
    description: "Get compact historical checks for one prompt.",
  },
  {
    name: "get_geo_sentiment",
    description:
      "Get aggregate GEO sentiment, engine breakdowns, timeseries and previous-period comparison",
  },
  {
    name: "get_geo_sentiment_analysis",
    description:
      "Get the stored thematic GEO sentiment analysis without starting a billed analysis run",
  },
  {
    name: "list_geo_sentiment_evidence",
    description:
      "List a bounded page of full answers used as sentiment evidence",
  },
  {
    name: "list_geo_shelf_sources",
    description:
      "List cited and manually tracked GEO shelf sources, including placements and opportunity state",
  },
  {
    name: "create_geo_scan",
    description: "Trigger a GEO visibility scan.",
  },
  {
    name: "rescan_geo_prompt",
    description:
      "Scan a single enabled tracked prompt against the project's answer engines, for example to check whether newly published content changed the answers.",
  },
  {
    name: "list_geo_scans",
    description:
      "List a project's GEO scans, newest first, with pagination, check totals by engine, and safe failure details",
  },
  {
    name: "get_geo_scan",
    description:
      "Get a GEO scan's status, planned and completed checks, mentions and explicit failures by engine, plus safe failure details when the scan failed",
  },
  {
    name: "get_geo_visibility_overview",
    description:
      "Get GEO mention rates per answer engine: checks, mentions and average position for every engine the project tracks",
  },
  {
    name: "get_geo_visibility_timeseries",
    description:
      "Get daily GEO mention counts per answer engine, one point per day and engine",
  },
  {
    name: "list_geo_prompt_result_summaries",
    description:
      "List filtered, paginated GEO prompt results without full answer text or sources.",
  },
  {
    name: "get_geo_prompt_result_detail",
    description:
      "Get the full answer, grounding sources and token metadata for one GEO check",
  },
  {
    name: "get_geo_competitor_share",
    description:
      "Get GEO share of voice: the top brands by mentions with their share of all mentions, plus a summary of the remaining brands.",
  },
  {
    name: "get_geo_language_share",
    description: "Get GEO mention rates broken down by tracked language",
  },
  {
    name: "get_geo_competitor_detail",
    description:
      "Get one competitor's GEO mention history: daily mentions and the prompts that produced them.",
  },
  {
    name: "list_geo_content_gaps",
    description:
      "List GEO content gaps: prompts where competitors are mentioned but this brand is not, plus Search Console queries with no tracked prompt.",
  },
  {
    name: "update_geo_content_gap",
    description:
      "Ignore a prompt gap from list_geo_content_gaps so it stops appearing there and in brief planning, or restore it with ignored false.",
  },
  {
    name: "list_geo_content_briefs",
    description: "List a project's GEO content briefs and their statuses.",
  },
  {
    name: "plan_geo_content_brief",
    description:
      "Research a topic and plan a GEO content brief, saved as a draft.",
  },
  {
    name: "get_geo_content_brief",
    description:
      "Get a single GEO content brief: the post's outline (sections, FAQ, internal links, checklist), writer status and the resulting post ID.",
  },
  {
    name: "update_geo_content_brief",
    description: "Edit a GEO content brief, the outline of a GEO post.",
  },
  {
    name: "approve_geo_content_brief",
    description: "Approve a GEO content brief and start the article writer.",
  },
  {
    name: "get_geo_agent_readiness",
    description:
      "Get the latest agent readiness report for the project's website: score, failed/partial checks with recommendations, any scan still in flight, and the score history.",
  },
  {
    name: "start_geo_agent_readiness_scan",
    description: "Queue an agent readiness scan of the project's website.",
  },
  {
    name: "get_geo_traffic_overview",
    description:
      "Get AI traffic totals for a project's website: crawler and AI-referral visit totals, a per-source breakdown and the daily timeseries behind it.",
  },
  {
    name: "get_geo_traffic_log",
    description:
      "Get the most recent individual requests from AI crawlers and referrals.",
  },
  {
    name: "list_geo_traffic_journeys",
    description:
      "List AI traffic journeys: sessions grouped by agent, showing how many pages one agent read, over what span, with sample paths",
  },
  {
    name: "get_geo_traffic_journey",
    description: "Get every event in one AI traffic journey",
  },
  {
    name: "list_geo_traffic_pages",
    description:
      "List the pages AI crawlers and referrals read most, with the previous window's count for comparison",
  },
  {
    name: "get_geo_mcp_analytics",
    description:
      "Get usage analytics for the user's own MCP server, reported by the @usenotra/geo SDK (not Notra's server): requests, tool calls, errors and p95 latency against the previous window, per-tool calls/errors/latency, clients, models, caller intents, recent failed requests and listed tools nobody called. configured is false when analytics are off for this deployment; empty totals mean the server has not sent events yet.",
  },
  {
    name: "get_geo_mcp_tool_analytics",
    description:
      "Get analytics for one tool on the user's own MCP server: which tools agents call right before and after it (and how often after a failure), its failures grouped by message, and the intents it was called for.",
  },
  {
    name: "get_geo_ingest_setup",
    description:
      "Get the tracking install: server snippets for AI traffic (Next.js, Nuxt, Netlify, TanStack Start, Astro, SvelteKit, React Router), log drain URLs, and the notra.js website analytics script: its public web key, script tag, and pinned script URLs with Subresource Integrity values.",
  },
  {
    name: "get_geo_web_analytics",
    description:
      "Get a project's website analytics from notra.js: page views, visitors, sessions, engaged sessions and visitors who arrived from AI assistants, each against the previous window of the same length, daily views and visitors, and the hosts seen.",
  },
  {
    name: "get_geo_web_analytics_breakdowns",
    description:
      "Get a project's website analytics breakdowns: top pages, referrer sources, countries (ISO codes), devices, languages, how AI-referred sessions behave, outbound link clicks (host and path only), Core Web Vitals (p75 in ms, CLS x1000) and JavaScript errors.",
  },
  {
    name: "get_geo_web_analytics_utm",
    description:
      "Get a project's website sessions per value of one UTM parameter (source, medium, campaign, term or content), with the previous window of the same length and visitors, top 25 values.",
  },
  {
    name: "get_geo_traffic_journey_stats",
    description:
      "Get AI journey statistics: exact journey counts per AI source and per page against the previous window, single fetches, deep crawls, entry pages and daily counts.",
  },
  {
    name: "list_geo_analytics_imports",
    description:
      "List a project's history imports from Plausible, Cloudflare or Vercel with their status and progress, newest first.",
  },
  {
    name: "whoami",
    description: "Show the current Notra workspace and authenticated account.",
  },
  {
    name: "list_workspaces",
    description:
      "List accepted and pending Notra workspaces available to the authenticated account.",
  },
  {
    name: "submit_feedback",
    description: "Send feedback to the Notra team.",
  },
];
