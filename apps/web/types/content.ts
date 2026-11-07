import type { ReactNode } from "react";

import type { notraChangelog } from "../.source/server";

export type ContentEntry = (typeof notraChangelog)[number];

export interface BlogArticleProps {
  children: ReactNode;
}
