import { beforeEach, describe, expect, mock, test } from "bun:test";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToReadableStream } from "react-dom/server";

const redirect = mock(() => {
  throw new Error("Unexpected redirect");
});
let hasAccess = false;

mock.module("next/navigation", () => ({
  redirect,
  unstable_rethrow: (error: unknown) => {
    throw error;
  },
}));
mock.module("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));
mock.module("@/lib/auth/actions", () => ({
  validateOrganizationAccess: async () => ({
    organization: { id: "org-1" },
    user: { name: "Test" },
    member: null,
  }),
}));
mock.module("@/lib/billing/subscription", () => ({
  resolveAiProductAccess: async () => ({ hasAccess }),
}));
mock.module("@/lib/nav/org-root-redirect", () => ({
  redirectOrgRootToStoredMode: async () => undefined,
}));
mock.module("@/lib/geo/initial-project.server", () => ({
  resolveInitialGeoProjectId: async () => undefined,
}));
mock.module("@/utils/dashboard-home-prefetch.server", () => ({
  dehydrateDashboardHomeQueries: async () => ({}),
}));
mock.module("@/utils/geo-hydration", () => ({
  geoRequestedProjectId: () => undefined,
}));
mock.module("@/utils/dashboard-greeting-period", () => ({
  getGreetingPeriod: () => "morning",
}));
mock.module("next-intl/server", () => ({
  getTranslations: async () => () => "",
}));
mock.module("../src/app/(dashboard)/[slug]/page-client", () => ({
  default: () => <div>Paid Studio home</div>,
}));
mock.module("@/components/dashboard/studio-upgrade-gate", () => ({
  StudioUpgradeGate: () => <div>Studio upgrade available</div>,
}));

const { DashboardHomePageShell } =
  await import("../src/app/(dashboard)/[slug]/home-page");

describe("Studio home for a free workspace", () => {
  beforeEach(() => {
    hasAccess = false;
    redirect.mockClear();
  });

  test("stays in Studio instead of redirecting to Feedback", async () => {
    const stream = await renderToReadableStream(
      <DashboardHomePageShell
        params={Promise.resolve({ slug: "free-workspace" })}
        searchParams={Promise.resolve({})}
      />
    );
    const html = await new Response(stream).text();

    expect(html).toContain("Studio upgrade available");
    expect(redirect).not.toHaveBeenCalled();
  });

  test("keeps the regular home for a paid workspace", async () => {
    hasAccess = true;
    const stream = await renderToReadableStream(
      <QueryClientProvider client={new QueryClient()}>
        <DashboardHomePageShell
          params={Promise.resolve({ slug: "paid-workspace" })}
          searchParams={Promise.resolve({})}
        />
      </QueryClientProvider>
    );
    const html = await new Response(stream).text();

    expect(html).toContain("Paid Studio home");
    expect(html).not.toContain("Studio upgrade available");
  });
});
