import type { Root } from "mdast";
import { visit } from "unist-util-visit";

import {
  ASSET_ATTRIBUTES,
  HTML_ATTRIBUTE,
  HTML_TAG,
  LINK_ATTRIBUTE,
  SRCSET_ELEMENTS,
} from "../constants/links";
import type { ContentLink, ContentLinkKind } from "../types/links";
import type { MdxJsxAttribute } from "../types/mdx";
import { isMdxJsxElement } from "./mdast";
import { srcsetCandidates } from "./srcset";

function attributeKind(
  element: string,
  attribute: string
): ContentLinkKind | null {
  if (attribute === LINK_ATTRIBUTE) {
    return "link";
  }
  return ASSET_ATTRIBUTES[element]?.includes(attribute) ? "image" : null;
}

function isSrcset(element: string, attribute: string): boolean {
  // srcSet in JSX, srcset in HTML.
  return SRCSET_ELEMENTS.has(element) && attribute.toLowerCase() === "srcset";
}

function attributeLinks(
  element: string,
  attribute: string,
  url: string,
  offset: number
): ContentLink[] {
  if (isSrcset(element, attribute)) {
    return srcsetCandidates(url).map((candidate) => ({
      url: candidate.url,
      kind: "image",
      offset,
    }));
  }
  const kind = attributeKind(element, attribute);
  return kind ? [{ url, kind, offset }] : [];
}

function htmlLinks(html: string, start: number): ContentLink[] {
  const links: ContentLink[] = [];
  for (const tag of html.matchAll(HTML_TAG)) {
    const element = tag[1]?.toLowerCase() ?? "";
    const attributesStart = start + tag.index + 1 + element.length;
    for (const attribute of (tag[2] ?? "").matchAll(HTML_ATTRIBUTE)) {
      links.push(
        ...attributeLinks(
          element,
          attribute[1]?.toLowerCase() ?? "",
          attribute[2] ?? attribute[3] ?? attribute[4] ?? "",
          attributesStart + attribute.index + 1
        )
      );
    }
  }
  return links;
}

/** A string attribute, or one whose braces hold only a string literal. */
function staticAttributeValue(value: MdxJsxAttribute["value"]): string | null {
  if (typeof value === "string") {
    return value;
  }
  const [statement] = value?.data?.estree?.body ?? [];
  if (statement?.type !== "ExpressionStatement") {
    return null;
  }
  const { expression } = statement;
  if (expression.type === "Literal") {
    return typeof expression.value === "string" ? expression.value : null;
  }
  if (
    expression.type === "TemplateLiteral" &&
    expression.expressions.length === 0
  ) {
    return expression.quasis[0]?.value.cooked ?? null;
  }
  return null;
}

/** Every link and file reference in a parsed Markdown or MDX file. */
export function contentLinks(tree: Root): ContentLink[] {
  const definitions = new Map<string, string>();
  visit(tree, "definition", (node) => {
    if (!definitions.has(node.identifier)) {
      definitions.set(node.identifier, node.url);
    }
  });
  const links: ContentLink[] = [];
  visit(tree, (node) => {
    const offset = node.position?.start.offset ?? 0;
    if (node.type === "link" || node.type === "image") {
      links.push({ url: node.url, kind: node.type, offset });
    } else if (
      node.type === "linkReference" ||
      node.type === "imageReference"
    ) {
      const url = definitions.get(node.identifier);
      if (url !== undefined) {
        links.push({
          url,
          kind: node.type === "linkReference" ? "link" : "image",
          offset,
        });
      }
    } else if (node.type === "html") {
      links.push(...htmlLinks(node.value, offset));
    } else if (isMdxJsxElement(node) && node.name) {
      for (const attribute of node.attributes) {
        if (attribute.type !== "mdxJsxAttribute") {
          continue;
        }
        const url = staticAttributeValue(attribute.value);
        if (url !== null) {
          links.push(
            ...attributeLinks(
              node.name,
              attribute.name,
              url,
              attribute.position?.start.offset ?? offset
            )
          );
        }
      }
    }
  });
  return links;
}
