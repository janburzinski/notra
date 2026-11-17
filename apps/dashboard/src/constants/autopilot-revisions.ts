import {
  Heading01Icon,
  Megaphone01Icon,
  ScissorIcon,
  SourceCodeIcon,
} from "@hugeicons/core-free-icons";

/** Hidden marker on the pull request comment a request from Notra posts. */
export const AUTOPILOT_REVISION_REQUEST_MARKER =
  "<!-- notra:dashboard-request -->";

/** Who asked, on GitHub, when the person has no name in Notra. */
export const AUTOPILOT_REVISION_ANONYMOUS_REQUESTER = "a workspace admin";

/** Delivery ids for requests from Notra, apart from GitHub's own. */
export const AUTOPILOT_REVISION_DELIVERY_PREFIX = "autopilot-revision:";

/** The latest comments on the pull request, which hold the requests and replies. */
export const AUTOPILOT_REVISION_MAX_COMMENTS = 30;

/** After this, a request without a reply counts as lost, not in progress. */
export const AUTOPILOT_REVISION_WORKING_TIMEOUT_MS = 15 * 60 * 1000;

/** While a request runs, the page checks the pull request this often. */
export const AUTOPILOT_REVISION_POLL_MS = 4000;

/** One-tap requests above the composer. */
export const AUTOPILOT_REVISION_SUGGESTIONS = [
  { label: "Make it shorter", icon: ScissorIcon },
  { label: "Punchier title", icon: Heading01Icon },
  { label: "Add a code example", icon: SourceCodeIcon },
  { label: "Less salesy", icon: Megaphone01Icon },
] as const;

/** What the working card cycles through while the agent edits the post. */
export const AUTOPILOT_REVISION_STEPS = [
  "Reading the pull request",
  "Reading the post",
  "Rewriting the post",
  "Checking the links",
  "Committing to the branch",
];
