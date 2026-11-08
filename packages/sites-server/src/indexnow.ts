import { SITE_R2_KEYS } from "@notra/sites-core/constants/sites";
import { siteManifestSchema } from "@notra/sites-core/schemas/deployment";
import type { SiteManifest } from "@notra/sites-core/types/deployment";
import { indexNowKey } from "@notra/sites-core/utils/indexnow";
import {
  joinMountPath,
  listMountedAreas,
} from "@notra/sites-core/utils/mounts";

import { INDEXNOW_MAX_URLS, INDEXNOW_TIMEOUT_MS } from "./constants/indexnow";
import { r2GetText } from "./r2";
import { indexNowUrl } from "./utils/provider-urls";

const SITEMAP_LOC = /<loc>([^<]+)<\/loc>/g;

async function readManifest(
  siteId: string,
  deploymentId: string
): Promise<SiteManifest | null> {
  const object = await r2GetText(SITE_R2_KEYS.manifest(siteId, deploymentId));
  return object ? siteManifestSchema.parse(JSON.parse(object.text)) : null;
}

async function sitemapUrls(
  siteId: string,
  deploymentId: string,
  mount: string
): Promise<string[]> {
  const object = await r2GetText(
    SITE_R2_KEYS.file(siteId, deploymentId, joinMountPath(mount, "sitemap.xml"))
  );
  return Array.from(object?.text.matchAll(SITEMAP_LOC) ?? [], (match) =>
    (match[1] ?? "").replaceAll("&amp;", "&")
  );
}

function markdownHashes(manifest: SiteManifest | null): Map<string, string> {
  return new Map(
    (manifest?.files ?? [])
      .filter((file) => file.path.endsWith("/index.md"))
      .map((file) => [file.path, file.sha256])
  );
}

function twinPath(url: string): string {
  return `${new URL(url).pathname.replace(/\/$/, "")}/index.md`;
}

// Tells IndexNow search engines (Bing and others) which sitemap pages a new
// production build added or changed. The markdown twin carries a page's
// content without the theme, so a theme rebuild submits nothing.
async function submitChangedUrls(
  siteId: string,
  previousDeploymentId: string | null,
  deploymentId: string
): Promise<void> {
  const manifest = await readManifest(siteId, deploymentId);
  if (!manifest || manifest.target.noindex || manifest.indexNow === false) {
    return;
  }
  const origin = new URL(manifest.target.publicOrigin);
  if (origin.protocol !== "https:") {
    return;
  }
  const previous = previousDeploymentId
    ? await readManifest(siteId, previousDeploymentId)
    : null;
  const hashes = markdownHashes(manifest);
  const previousHashes = markdownHashes(previous);
  const key = await indexNowKey(siteId);
  for (const { mount } of listMountedAreas(manifest.target.mounts)) {
    const known = new Set(
      previous ? await sitemapUrls(siteId, previous.deploymentId, mount) : []
    );
    const urlList = (await sitemapUrls(siteId, deploymentId, mount))
      .filter(
        (url) =>
          !known.has(url) ||
          hashes.get(twinPath(url)) !== previousHashes.get(twinPath(url))
      )
      .slice(0, INDEXNOW_MAX_URLS);
    if (urlList.length === 0) {
      continue;
    }
    const response = await fetch(indexNowUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: origin.hostname,
        key,
        keyLocation: `${origin.origin}${joinMountPath(mount, `${key}.txt`)}`,
        urlList,
      }),
      signal: AbortSignal.timeout(INDEXNOW_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn("sites.indexnow_rejected", {
        siteId,
        mount,
        status: response.status,
      });
    }
  }
}

export async function notifyIndexNow(
  siteId: string,
  previousDeploymentId: string | null,
  deploymentId: string
): Promise<void> {
  await submitChangedUrls(siteId, previousDeploymentId, deploymentId).catch(
    (error: unknown) => {
      console.warn("sites.indexnow_failed", { siteId, error: String(error) });
    }
  );
}
