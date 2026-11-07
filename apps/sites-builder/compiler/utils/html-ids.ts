import { SAXParser } from "parse5-sax-parser";

import { CLIENT_ONLY_ISLAND } from "../constants/html-ids";

/**
 * The IDs a #fragment can scroll to on a built page: every id, and the name
 * of an <a>, outside comments, <template> contents and raw text like
 * <script>, which the tokenizer reads as text. Null when an island renders
 * only in the browser, so its IDs aren't in the page.
 */
export function htmlIds(html: string): Set<string> | null {
  if (html.includes(CLIENT_ONLY_ISLAND)) {
    return null;
  }
  const ids = new Set<string>();
  const parser = new SAXParser();
  let templates = 0;
  parser.on("startTag", (token) => {
    if (templates === 0) {
      for (const { name, value } of token.attrs) {
        if (name === "id" || (name === "name" && token.tagName === "a")) {
          ids.add(value);
        }
      }
    }
    if (token.tagName === "template" && !token.selfClosing) {
      templates += 1;
    }
  });
  parser.on("endTag", (token) => {
    if (token.tagName === "template" && templates > 0) {
      templates -= 1;
    }
  });
  parser.end(html);
  return ids;
}
