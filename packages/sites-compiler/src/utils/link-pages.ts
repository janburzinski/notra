import {
  SITE_CHROME_FILES,
  SITE_SLOTS_DIR,
} from "@notra/sites-core/constants/site-layout";
import type { SiteArea } from "@notra/sites-core/types/deployment";

import {
  AUTHOR_PAGES_PATH,
  CHROME_AREAS,
  SLOT_PAGES,
} from "../constants/links";
import type { LinkPage } from "../types/links";

const CONTENT_IMPORT = /\.mdx?$/i;

/** The pages a header, footer or slot file renders on, or null for other files. */
function chromePages(
  path: string,
  entryPages: ReadonlyMap<SiteArea, readonly LinkPage[]>
): LinkPage[] | null {
  if ((SITE_CHROME_FILES as readonly string[]).includes(path)) {
    return CHROME_AREAS.map((area) => ({ area }));
  }
  const name = path.startsWith(`${SITE_SLOTS_DIR}/`)
    ? path.slice(SITE_SLOTS_DIR.length + 1).replace(/\.mdx$/, "")
    : "";
  const slot = Object.hasOwn(SLOT_PAGES, name) ? SLOT_PAGES[name] : undefined;
  if (slot === undefined) {
    return null;
  }
  if (slot === "every") {
    return CHROME_AREAS.map((area) => ({ area }));
  }
  if (slot.on === "authors") {
    return [{ area: slot.area, under: AUTHOR_PAGES_PATH }];
  }
  return slot.on === "index"
    ? [{ area: slot.area }]
    : [...(entryPages.get(slot.area) ?? [])];
}

/**
 * The pages each shared file renders on: headers, footers and slots, and the
 * snippets that entries, headers, footers and slots import, directly or not.
 */
export function sharedFilePages(
  paths: Iterable<string>,
  entries: ReadonlyMap<string, LinkPage>,
  imports: (path: string) => readonly string[]
): Map<string, LinkPage[]> {
  const entryPages = new Map<SiteArea, LinkPage[]>();
  for (const page of entries.values()) {
    entryPages.set(page.area, [...(entryPages.get(page.area) ?? []), page]);
  }
  const shared = new Map<string, LinkPage[]>();
  const roots: [string, LinkPage[]][] = [...entries].map(([path, page]) => [
    path,
    [page],
  ]);
  for (const path of paths) {
    const pages = chromePages(path, entryPages);
    if (pages) {
      shared.set(path, [...pages]);
      roots.push([path, pages]);
    }
  }
  for (const [root, pages] of roots) {
    const seen = new Set([root]);
    const pending = [...imports(root)];
    for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
      if (seen.has(path) || !CONTENT_IMPORT.test(path)) {
        continue;
      }
      seen.add(path);
      const known = shared.get(path) ?? [];
      known.push(...pages);
      shared.set(path, known);
      pending.push(...imports(path));
    }
  }
  return shared;
}
