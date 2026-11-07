import { LLMS_LINKS } from "../constants/request-paths";

/** The deployment path the Sites worker serves a request path from. */
export function normalizeRequestPath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\")) {
    return null;
  }
  const segments: string[] = [];
  for (const segment of decoded.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      return null;
    }
    segments.push(segment);
  }
  const normalized = `/${segments.join("/")}`;
  return decoded.endsWith("/") && normalized !== "/"
    ? `${normalized}/`
    : normalized;
}

export function resolveFile<File>(
  files: ReadonlyMap<string, File>,
  path: string
): File | null {
  const trimmed = path.endsWith("/") ? path.slice(0, -1) : path;
  const candidates = path.endsWith("/")
    ? [`${trimmed}/index.html`]
    : [path, `${path}/index.html`, `${path}.html`];
  if (path === "/") {
    candidates.unshift("/index.html");
  }
  for (const candidate of candidates) {
    const file = files.get(candidate);
    if (file) {
      return file;
    }
  }
  return null;
}

export function resolveMarkdownFile<File>(
  files: ReadonlyMap<string, File>,
  path: string
): File | null {
  if (!path.endsWith(".md")) {
    return null;
  }
  return files.get(path) ?? files.get(`${path.slice(0, -3)}/index.md`) ?? null;
}

export function wellKnownLlmsTxtTarget(
  files: ReadonlyMap<string, unknown>,
  path: string
): string | null {
  const resource = LLMS_LINKS.find(({ file }) =>
    path.endsWith(`/.well-known/${file}`)
  );
  if (!resource) {
    return null;
  }
  const target = `${path.slice(0, -`/.well-known/${resource.file}`.length)}/${resource.file}`;
  return files.has(target) ? target : null;
}
