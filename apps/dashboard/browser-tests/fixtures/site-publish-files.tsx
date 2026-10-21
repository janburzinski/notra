import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { SiteContext } from "../../src/components/sites/site-context";
import { useSitePublishFiles } from "../../src/lib/hooks/use-site-publish-files";
import type { SiteDetail } from "../../src/types/sites";

const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function PublishControls() {
  const publish = useSitePublishFiles({
    noDrafts: "No drafts",
    failed: "Preparation failed",
  });
  return (
    <>
      <button
        onClick={() => {
          void publish.open();
        }}
        type="button"
      >
        Publish
      </button>
      <button onClick={publish.close} type="button">
        Close
      </button>
      <output data-testid="preparing">{String(publish.preparing)}</output>
      <output data-testid="drafts">
        {publish.files?.drafts.map((draft) => draft.path).join(",") ?? "None"}
      </output>
    </>
  );
}

function App() {
  const [organizationId, setOrganizationId] = useState("org-a");
  const [siteId, setSiteId] = useState("site-a");
  return (
    <QueryClientProvider client={client}>
      <SiteContext
        value={{
          organizationId,
          organizationSlug: organizationId,
          siteId,
          detail: {} as SiteDetail,
          liveDeployment: null,
        }}
      >
        <button onClick={() => setSiteId("site-a")} type="button">
          Site A
        </button>
        <button onClick={() => setSiteId("site-b")} type="button">
          Site B
        </button>
        <button onClick={() => setOrganizationId("org-b")} type="button">
          Other organization
        </button>
        <PublishControls />
        <Toaster />
      </SiteContext>
    </QueryClientProvider>
  );
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Publish fixture root missing");
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
