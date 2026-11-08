import type { ContentResponse } from "@notra/schemas/dashboard/content";
import type { ContentAuthor } from "@notra/schemas/shared/post-metadata";
import { SidebarProvider } from "@notra/ui/components/ui/sidebar";
import { TooltipProvider } from "@notra/ui/components/ui/tooltip";
import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { type ComponentProps, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import { IntlProvider } from "use-intl";

import messages from "../../messages/en.json";
import { ContentOverview } from "../../src/components/content/overview/content-overview";
import { SiteDesignPage } from "../../src/components/sites/pages/site-design-page";
import { SiteChangesBanner } from "../../src/components/sites/site-changes-banner";
import { SiteContext } from "../../src/components/sites/site-context";
import {
  SiteMobileNav,
  SiteSidebar,
} from "../../src/components/sites/site-sidebar";
import { SiteWorkspace } from "../../src/components/sites/site-workspace";
import { useSiteWorkspace } from "../../src/components/sites/site-workspace-context";
import { SitesPageShell } from "../../src/components/sites/sites-page-shell";
import { SITE_DESIGN_SECTIONS } from "../../src/constants/site-design-sections";
import type { DashboardORPCClient } from "../../src/lib/orpc/client";
import type { SitePublishDialogProps } from "../../src/types/components/sites";
import type { SiteBranchControlsProps } from "../../src/types/site-branches";
import type { SiteDraftInput } from "../../src/types/site-drafts";
import type { SiteContextValue } from "../../src/types/sites";
import { siteAuthorRefId } from "../../src/utils/site-author-refs";
import { buildSiteEntryMarkdown } from "../../src/utils/site-github-publish";
import type { WorkspaceFixtureRecord } from "../types/site-workspace";

const params = new URLSearchParams(location.search);
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});
const sourceContext = {
  repositoryId: "",
  productionBranch: "main",
  rootDirectory: "",
};
const SITE = { organizationId: "org-a", siteId: "site-a" };
const POST = { organizationId: "org-a", contentId: "post-a" };
const published = JSON.stringify({
  name: "Acme",
  authors: {
    jan: {
      name: "Jan Burzinski",
      title: "Engineer",
      avatar: "/images/jan.png",
      bio: "Builds the publishing pipeline.",
      github: "https://github.com/janburzinski",
    },
    lena: {
      name: "Lena Park",
      title: "Product designer",
      avatar: "/images/lena.png",
    },
  },
});
const record: WorkspaceFixtureRecord = {
  document: {
    path: "blog.json",
    encoding: "utf8",
    content: published,
    published,
    blobSha: "blob-1",
    publishedBlobSha: "blob-1",
    hasDraft: false,
    draftId: null,
    draftRevision: null,
    sourceContext,
  },
  files: { commitSha: "commit-1", sourceContext, files: [], drafts: [] },
};
const contentAuthor = (
  id: string,
  slug: string,
  name: string,
  title: string,
  avatarUrl: string | null
): ContentAuthor => ({
  id,
  slug,
  name,
  title,
  bio: null,
  avatarUrl,
  url: "https://example.com",
  x: null,
  linkedin: null,
  github: null,
  bluesky: null,
  mastodon: null,
  youtube: null,
  threads: null,
  instagram: null,
  userId: null,
});
const contentAuthors = [
  contentAuthor("db-jan", "jan", "Jan Burzinski", "Engineer", null),
  contentAuthor(
    "db-sam",
    "sam-rivera",
    "Sam Rivera",
    "Developer advocate",
    "/api/uploads/content-images/organization/org-a/content/sam.png"
  ),
  contentAuthor("db-priya", "priya", "Priya Natarajan", "Writer", null),
];
let post: ContentResponse = {
  id: POST.contentId,
  revision: 1,
  title: "Dark mode is here",
  slug: "dark-mode",
  content: "",
  htmlUrl: null,
  markdown: "Dark mode ships today.\n",
  rawHtml: null,
  recommendations: null,
  contentType: "blog_post",
  status: "draft",
  date: "2026-11-01T00:00:00.000Z",
  sourceMetadata: null,
  githubPublish: null,
  metadata: {
    coverImage: null,
    tags: [],
    excerpt: null,
    authorIds: params.has("legacy") ? ["db-jan"] : [],
    featured: false,
    noindex: false,
    hidden: false,
    displayDate: null,
  },
};
const saves: unknown[] = [];
const saveListeners = new Set<() => void>();

const rpc = createORPCClient<DashboardORPCClient>({
  call: async (path, input) => {
    switch (path.join(".")) {
      case "sites.editor.read":
        return structuredClone(record.document);
      case "sites.editor.files":
        return structuredClone(record.files);
      case "sites.editor.saveDraft": {
        const draft = input as SiteDraftInput;
        const revision = (record.document.draftRevision ?? 0) + 1;
        record.document = {
          ...record.document,
          content: draft.content,
          hasDraft: true,
          draftId: "draft-1",
          draftRevision: revision,
        };
        record.files.drafts = [
          {
            path: "blog.json",
            id: "draft-1",
            revision,
            deleted: false,
            baseBlobSha: "blob-1",
            updatedAt: new Date(),
          },
        ];
        return {
          path: draft.path,
          draftId: "draft-1",
          draftRevision: revision,
          updatedAt: new Date(),
        };
      }
      case "sites.editor.uploadImage":
        return { path: "/images/sam-rivera-0123456789.png", draft: null };
      case "sites.authors.usage":
        return { posts: { jan: 2 } };
      case "sites.authors.forPost":
        return {
          site: {
            id: SITE.siteId,
            name: "Acme",
            liveUrl: "https://acme.example.test/blog",
          },
        };
      case "content.authors.list":
        return { authors: contentAuthors, currentUserId: "user-a" };
      case "content.get":
        return { content: post, collection: null };
      case "content.updateMetadata": {
        const { metadata } = input as {
          metadata: Partial<ContentResponse["metadata"]>;
        };
        saves.push(metadata);
        for (const listener of saveListeners) {
          listener();
        }
        post = { ...post, metadata: { ...post.metadata, ...metadata } };
        return { content: post, githubSyncError: null };
      }
      default:
        throw new Error(`Unexpected RPC ${path.join(".")}`);
    }
  },
});
export const dashboardOrpc = createTanstackQueryUtils(rpc, {
  path: ["dashboard"],
});

// Browser-only boundaries; the workspace, forms, queries and saves are real.
export const parseAsString = null;
export function useQueryState(key: string) {
  return [key === "author" ? params.get("author") : null, async () => {}];
}
export function useLocation() {
  return { pathname: "/", search: {}, hash: "" };
}
export function Link({
  to,
  search,
  children,
  activeOptions: _activeOptions,
  preload: _preload,
  resetScroll: _resetScroll,
  replace: _replace,
  hash: _hash,
  ...props
}: {
  to: string;
  search?: Record<string, string>;
  activeOptions?: unknown;
  preload?: unknown;
  resetScroll?: unknown;
  replace?: unknown;
  hash?: unknown;
} & Omit<ComponentProps<"a">, "hash">) {
  const query = new URLSearchParams(search).toString();
  return (
    <a {...props} href={query ? `${to}?${query}` : to}>
      {children}
    </a>
  );
}
export function useBlocker() {}
export function useSiteDesignSection() {
  return {
    active:
      SITE_DESIGN_SECTIONS.find((section) => section.id === "authors") ??
      SITE_DESIGN_SECTIONS[0],
    select: () => {},
  };
}
export function useSiteNavSection() {
  return { current: "design", section: "design", branch: null } as const;
}
export function useSiteBrandDefaults() {
  return { brand: null, available: false };
}
export function useProjectBrandDefaults() {
  return useSiteBrandDefaults();
}
export function SiteDesignIntegrations() {
  return null;
}
export function useSiteWorkingBranch() {
  return {
    commitStatus: "idle",
    switchBranch: async () => {},
    flush: async () => {},
  };
}
export function useSiteBranchControls(props: SiteBranchControlsProps) {
  return { props, retrySave: () => {}, queries: { status: { data: null } } };
}
export function SiteBranchActionDialog() {
  return null;
}
export function SitePublishDialog(_props: SitePublishDialogProps) {
  return null;
}

function Flush() {
  const state = useSiteWorkspace();
  return (
    <>
      <button
        hidden
        onClick={() => {
          void state?.saves.flush().catch(() => {});
        }}
        type="button"
      >
        Flush
      </button>
      <output data-testid="status" hidden>
        {state?.saves.state.status}
      </output>
      <output data-testid="persisted" hidden>
        {state ? record.document.content : ""}
      </output>
    </>
  );
}

function DesignFixture() {
  const context = {
    ...SITE,
    organizationSlug: "acme",
    detail: {
      site: {
        id: SITE.siteId,
        name: "Acme",
        status: "active",
        productionBranch: "main",
        rootDirectory: "",
        projectId: "project",
        publicOrigin: "https://acme.example.test",
        liveUrl: "https://acme.example.test/blog",
        mounts: { blog: "/blog", changelog: "/changelog" },
        liveDeploymentId: "deployment-1",
      },
      deployments: [],
    },
    liveDeployment: null,
  } as unknown as SiteContextValue;
  return (
    <SiteContext value={context}>
      <SiteWorkspace>
        <div className="flex h-svh min-h-0 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1">
            <SiteSidebar />
            <div className="scrollbar-stable flex min-h-0 min-w-0 flex-1 scrollbar-thin flex-col overflow-x-hidden overflow-y-auto">
              <SiteMobileNav />
              <SiteChangesBanner />
              <SitesPageShell>
                <SiteDesignPage />
              </SitesPageShell>
            </div>
          </div>
        </div>
        <Flush />
      </SiteWorkspace>
    </SiteContext>
  );
}

function Saves() {
  const count = useSyncExternalStore(
    (listener) => {
      saveListeners.add(listener);
      return () => saveListeners.delete(listener);
    },
    () => saves.length
  );
  return (
    <output data-count={count} data-testid="saves" hidden>
      {JSON.stringify(saves)}
    </output>
  );
}

function EditorFixture() {
  const { data } = useQuery(
    dashboardOrpc.content.get.queryOptions({ input: POST })
  );
  if (!data) {
    return null;
  }
  const authorIds = data.content.metadata.authorIds;
  return (
    <div className="flex h-svh justify-end overflow-hidden">
      <aside className="bg-background w-full overflow-y-auto border-s sm:w-96">
        <ContentOverview
          content={data.content}
          contentId={POST.contentId}
          organizationId={POST.organizationId}
          organizationSlug="acme"
        />
      </aside>
      <Saves />
      <pre data-testid="frontmatter" hidden>
        {buildSiteEntryMarkdown({
          contentType: "blog_post",
          markdown: data.content.markdown ?? "",
          title: data.content.title,
          date: new Date(data.content.date),
          // The publisher's mapping: site author entries become their blog.json id.
          metadata: {
            authors: authorIds.flatMap((id) => siteAuthorRefId(id) ?? []),
          },
        })}
      </pre>
    </div>
  );
}

function Fixture() {
  return (
    <IntlProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <SidebarProvider className="min-h-0">
            <div className="w-full">
              {params.has("editor") ? <EditorFixture /> : <DesignFixture />}
            </div>
          </SidebarProvider>
        </TooltipProvider>
        <Toaster />
      </QueryClientProvider>
    </IntlProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Fixture />);
}
