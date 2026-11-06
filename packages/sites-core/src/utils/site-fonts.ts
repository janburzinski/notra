import {
  DEFAULT_HEADING_WEIGHT,
  FONT_COMMON_WEIGHTS,
  FONT_CSS_MAX_BYTES,
  FONT_DOWNLOAD_CONCURRENCY,
  FONT_FETCH_TIMEOUT_MS,
  FONT_FILE_MAX_BYTES,
  FONT_LICENSE_LOCATIONS,
  FONT_PATH_RE,
  FONT_URL_RE,
  FONT_USER_AGENT,
  FONT_WEIGHT_RANGES,
  GOOGLE_FONTS_CSS_URL,
  GOOGLE_FONTS_ENDPOINTS,
} from "../constants/fonts";
import type {
  SiteFontDownloadOptions,
  SiteFontEndpoints,
  SiteFontFile,
  SiteFontPlan,
} from "../types/fonts";
import type { SiteConfig } from "../types/site-config";
import { sha256Hex } from "./hash";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class FontRequestError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Font download failed (${status})`);
    this.status = status;
  }
}

function discreteWeights(weights: number[]): string {
  return [...new Set(weights)].sort((a, b) => a - b).join(";");
}

/**
 * Weight specs to try per family, best first: ranges for variable fonts, then
 * the exact weights, which static fonts like Lato only serve one by one.
 */
function weightCandidates(weights: (number | undefined)[]): string[] {
  const explicit = weights.filter((weight) => weight !== undefined);
  if (!weights.includes(undefined)) {
    return [discreteWeights(explicit)];
  }
  const ranges = FONT_WEIGHT_RANGES.map(([min, max]) => {
    const low = Math.min(min, ...explicit);
    const high = Math.max(max, ...explicit);
    return low === high ? `${low}` : `${low}..${high}`;
  });
  return [
    ...new Set([
      ...ranges,
      discreteWeights([...FONT_COMMON_WEIGHTS, ...explicit]),
      discreteWeights([400, ...explicit]),
      "400",
    ]),
  ];
}

function headingSpec(fonts: SiteConfig["fonts"]) {
  if (fonts?.heading?.family) {
    return fonts.heading;
  }
  return fonts?.family ? fonts : fonts?.body;
}

function requestedWeights(
  fonts: SiteConfig["fonts"]
): Map<string, (number | undefined)[]> {
  const headingWeight = fonts?.heading?.weight;
  const uses = [
    {
      spec: fonts?.body?.family ? fonts.body : fonts,
      weights: [fonts?.body?.weight ?? fonts?.weight],
    },
    {
      spec: headingSpec(fonts),
      weights:
        headingWeight === undefined
          ? [undefined, DEFAULT_HEADING_WEIGHT]
          : [headingWeight],
    },
  ];
  const families = new Map<string, (number | undefined)[]>();
  for (const { spec, weights } of uses) {
    if (spec?.family && !spec.source && !spec.faces) {
      families.set(spec.family, [
        ...(families.get(spec.family) ?? []),
        ...weights,
      ]);
    }
  }
  return families;
}

function googleFontsUrl(specs: Map<string, string>): URL {
  const url = new URL(GOOGLE_FONTS_CSS_URL);
  for (const [family, spec] of [...specs].sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    url.searchParams.append("family", `${family}:wght@${spec}`);
  }
  url.searchParams.set("display", "swap");
  return url;
}

function cssRequestUrl(url: URL, endpoints: SiteFontEndpoints): string {
  const target = new URL(endpoints.css);
  target.search = url.search;
  return target.toString();
}

async function shortHash(data: Uint8Array<ArrayBuffer>): Promise<string> {
  return (await sha256Hex(data)).slice(0, 16);
}

async function fetchFontAsset(
  url: string,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Uint8Array<ArrayBuffer>> {
  const timeout = AbortSignal.timeout(FONT_FETCH_TIMEOUT_MS);
  const response = await fetch(url, {
    redirect: "error",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    headers: { "User-Agent": FONT_USER_AGENT },
  });
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new FontRequestError(response.status);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > maxBytes) {
        throw new Error("Font download exceeded its size limit");
      }
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function firstSupportedSpec(
  family: string,
  options: string[],
  endpoints: SiteFontEndpoints,
  signal?: AbortSignal
): Promise<string> {
  for (const spec of options) {
    try {
      await fetchFontAsset(
        cssRequestUrl(googleFontsUrl(new Map([[family, spec]])), endpoints),
        FONT_CSS_MAX_BYTES,
        signal
      );
      return spec;
    } catch (error) {
      if (!(error instanceof FontRequestError && error.status === 400)) {
        throw error;
      }
    }
  }
  throw new Error(`Google Fonts has no ${family} in the requested weights`);
}

async function supportedFontsUrl(
  candidates: SiteFontPlan["candidates"],
  endpoints: SiteFontEndpoints,
  signal?: AbortSignal
): Promise<URL> {
  const specs = await Promise.all(
    candidates.map(
      async ([family, options]) =>
        [
          family,
          await firstSupportedSpec(family, options, endpoints, signal),
        ] as const
    )
  );
  return googleFontsUrl(new Map(specs));
}

async function fetchFontLicense(
  family: string,
  endpoints: SiteFontEndpoints,
  signal?: AbortSignal
): Promise<Uint8Array<ArrayBuffer>> {
  const directory = family.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [category, name] of FONT_LICENSE_LOCATIONS) {
    try {
      return await fetchFontAsset(
        `${endpoints.licenses}/${category}/${directory}/${name}`,
        FONT_CSS_MAX_BYTES,
        signal
      );
    } catch {
      // Older fonts use Apache or Ubuntu licenses instead of OFL.
      signal?.throwIfAborted();
    }
  }
  throw new Error(
    `Could not retrieve the redistribution license for ${family}`
  );
}

async function downloadFontFiles(
  url: URL,
  families: string[],
  requireEveryFamily: boolean,
  endpoints: SiteFontEndpoints,
  signal?: AbortSignal
): Promise<SiteFontFile[]> {
  const css = decoder.decode(
    await fetchFontAsset(
      cssRequestUrl(url, endpoints),
      FONT_CSS_MAX_BYTES,
      signal
    )
  );
  const urls = [
    ...new Set(
      [...css.matchAll(FONT_URL_RE)].flatMap((match) =>
        match[1] ? [match[1]] : []
      )
    ),
  ];
  if (urls.length === 0) {
    throw new Error("Font stylesheet contains no font files");
  }
  // With several families, Google answers 200 and silently drops a family
  // whose weights don't exist, so treat that like the single-family 400.
  const served = css.toLowerCase();
  if (
    requireEveryFamily &&
    families.some(
      (family) => !served.includes(`font-family: '${family.toLowerCase()}'`)
    )
  ) {
    throw new FontRequestError(400);
  }
  const sources = urls.map((source) => {
    const parsed = new URL(source);
    if (
      parsed.origin !== new URL(endpoints.files).origin ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      !FONT_PATH_RE.test(parsed.pathname)
    ) {
      throw new Error("Unsupported font file URL");
    }
    return { source, extension: parsed.pathname.split(".").at(-1) };
  });
  const files: SiteFontFile[] = [];
  const replacements = new Map<string, string>();
  const downloads = families.map((family) => async () => {
    const license = await fetchFontLicense(family, endpoints, signal);
    files.push({
      name: `font-license-${await shortHash(license)}.txt`,
      data: license,
    });
  });
  downloads.push(
    ...sources.map(({ source, extension }) => async () => {
      const bytes = await fetchFontAsset(source, FONT_FILE_MAX_BYTES, signal);
      const name = `font-${await shortHash(bytes)}.${extension}`;
      files.push({ name, data: bytes });
      replacements.set(source, `./${name}`);
    })
  );
  const results = await Promise.allSettled(
    Array.from({ length: FONT_DOWNLOAD_CONCURRENCY }, async () => {
      let download = downloads.shift();
      while (download) {
        // A cancelled build takes no further downloads from the queue.
        signal?.throwIfAborted();
        await download();
        download = downloads.shift();
      }
    })
  );
  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }
  const localCss = css.replace(
    FONT_URL_RE,
    (_, source: string) => `url("${replacements.get(source)}")`
  );
  if (/https?:\/\//i.test(localCss) || /@import/i.test(localCss)) {
    throw new Error("Unsupported external font stylesheet reference");
  }
  const stylesheet = encoder.encode(localCss);
  files.push({
    name: `fonts-${await shortHash(stylesheet)}.css`,
    data: stylesheet,
  });
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

/** The Google Fonts a config needs, or null when it names none. */
export async function planSiteFonts(
  fonts: SiteConfig["fonts"]
): Promise<SiteFontPlan | null> {
  const families = requestedWeights(fonts);
  if (families.size === 0) {
    return null;
  }
  const candidates = [...families].map(
    ([family, weights]) => [family, weightCandidates(weights)] as const
  );
  const url = googleFontsUrl(
    new Map(candidates.map(([family, specs]) => [family, specs[0] ?? ""]))
  ).toString();
  return {
    key: await sha256Hex(encoder.encode(url + JSON.stringify(candidates))),
    url,
    families: [...families.keys()],
    candidates,
  };
}

/**
 * Downloads a plan's stylesheet, font files and licenses, with the stylesheet pointing at the
 * files. Aborting `signal` cancels the requests in flight and starts no new ones.
 */
export async function downloadSiteFonts(
  plan: SiteFontPlan,
  { signal, endpoints = GOOGLE_FONTS_ENDPOINTS }: SiteFontDownloadOptions = {}
): Promise<SiteFontFile[]> {
  try {
    return await downloadFontFiles(
      new URL(plan.url),
      plan.families,
      true,
      endpoints,
      signal
    );
  } catch (error) {
    if (!(error instanceof FontRequestError && error.status === 400)) {
      throw error;
    }
    // A font without the full default range: retry with ranges it has.
    return await downloadFontFiles(
      await supportedFontsUrl(plan.candidates, endpoints, signal),
      plan.families,
      false,
      endpoints,
      signal
    );
  }
}
