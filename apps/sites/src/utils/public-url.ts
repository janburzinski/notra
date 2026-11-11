/**
 * A page's address under the site's public origin. `new URL("//x/y", base)`
 * would switch to host `x`, so a path that starts with `//` is appended to
 * the origin instead of resolved against it.
 */
export function publicPageUrl(pathAndQuery: string, publicOrigin: string) {
  return new URL(`${new URL(publicOrigin).origin}${pathAndQuery}`).href;
}
