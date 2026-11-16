import { agentside } from "@usenotra/agentside";

import { MARKDOWN_CACHE_CONTROL } from "@/constants/not-found";
import { MARKDOWN_SKIP_PATHS } from "@/constants/proxy";
import { buildMarkdownRoutes } from "@/utils/markdown-twins";

export const twins = agentside({
  routes: buildMarkdownRoutes(),
  skip: MARKDOWN_SKIP_PATHS,
  cacheControl: MARKDOWN_CACHE_CONTROL,
});
