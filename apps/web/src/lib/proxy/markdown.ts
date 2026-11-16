import {
  detectAgent,
  negotiateFormat,
  toMarkdownPath,
} from "@usenotra/agentside";

import { STATIC_INTEGRATION_PAGE_SLUGS } from "@/constants/integrations";
import { IP_CHECKER_PATH } from "@/constants/ip-checker";
import { DYNAMIC_PAGE_CACHE_CONTROL } from "@/constants/proxy";
import { QR_CODE_PATH } from "@/constants/qr-code";
import { UTM_BUILDER_PATH } from "@/constants/utm-builder";
import { twins } from "@/lib/markdown/twins";
import { serveQrCodeMarkdown } from "@/lib/qr-code/markdown";
import { serveUtmBuilderMarkdown } from "@/lib/utm-builder/markdown";
import { markdownNotFoundResponse } from "@/utils/not-found";

const TRAILING_SLASHES_REGEX = /\/+$/;
const INTEGRATIONS_REGEX = /^\/integrations(?:\/([^/]+?))?(?:\.md)?\/?$/;
const TOOL_MARKDOWN = new Map([
  [UTM_BUILDER_PATH, serveUtmBuilderMarkdown],
  [QR_CODE_PATH, serveQrCodeMarkdown],
]);
const TOOL_PAGES = new Set([UTM_BUILDER_PATH, QR_CODE_PATH, IP_CHECKER_PATH]);

export function appendHeaderValue(
  headers: Headers,
  name: string,
  value: string
) {
  const existing = headers.get(name);
  headers.set(name, existing ? `${existing}, ${value}` : value);
}

function isMarkdown(response: Response) {
  return response.headers.get("content-type")?.startsWith("text/markdown");
}

export async function negotiateMarkdown(
  request: Request,
  next: () => Promise<Response>
) {
  const { pathname } = new URL(request.url);
  const pagePath = pathname.replace(TRAILING_SLASHES_REGEX, "");
  const acceptsMarkdown =
    negotiateFormat(request.headers.get("accept"), "contains") === "markdown";

  if (TOOL_PAGES.has(pagePath)) {
    const serveTool = TOOL_MARKDOWN.get(pagePath);
    const wantsMarkdown =
      acceptsMarkdown ||
      detectAgent(request.headers.get("user-agent")) !== null;
    const response =
      serveTool && wantsMarkdown ? serveTool(request) : await next();
    if (!isMarkdown(response)) {
      appendHeaderValue(
        response.headers,
        "Link",
        `<${toMarkdownPath(pagePath)}>; rel="alternate"; type="text/markdown"`
      );
    }
    response.headers.set("Vary", "Accept, User-Agent");
    return response;
  }

  const response = await twins.handle(request, next);
  if (!isMarkdown(response)) {
    return response;
  }
  if (response.status === 404) {
    return markdownNotFoundResponse();
  }
  const integration = INTEGRATIONS_REGEX.exec(pathname);
  if (integration && !STATIC_INTEGRATION_PAGE_SLUGS.has(integration[1] ?? "")) {
    response.headers.set("Cache-Control", DYNAMIC_PAGE_CACHE_CONTROL);
  }
  return response;
}
