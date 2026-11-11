import type { SiteMounts } from "@notra/sites-core/types/deployment";

export function siteBlogFolder(rootDirectory: string, mounts: SiteMounts) {
  if (!mounts.blog) {
    return null;
  }
  const root = rootDirectory.replace(/^\/+|\/+$/g, "");
  return root ? `${root}/blog` : "blog";
}
