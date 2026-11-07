import type { SiteDiagnostic } from "@notra/sites-core/types/build";
import type { Root } from "mdast";
import { visit } from "unist-util-visit";

import {
  BLOCKED_ELEMENT_HINT,
  BLOCKED_HTML_ELEMENTS,
  HTML_OPENING_TAG,
} from "../constants/elements";
import { offsetToLineColumn } from "./paths";

export function blockedMarkdownHtml(
  path: string,
  source: string,
  tree: Root
): SiteDiagnostic[] {
  const diagnostics: SiteDiagnostic[] = [];
  visit(tree, "html", (node) => {
    for (const match of node.value.matchAll(HTML_OPENING_TAG)) {
      const tag = match[1]?.toLowerCase() ?? "";
      if (BLOCKED_HTML_ELEMENTS.has(tag)) {
        diagnostics.push({
          severity: "error",
          code: "blocked_element",
          file: path,
          message: `<${tag}> ${BLOCKED_ELEMENT_HINT}`,
          ...offsetToLineColumn(
            source,
            (node.position?.start.offset ?? 0) + (match.index ?? 0)
          ),
        });
      }
    }
  });
  return diagnostics;
}
