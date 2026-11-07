import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

import messages from "../../messages/en.json";
import { SiteIntegrationDialog } from "../../src/components/sites/site-integration-dialog";
import { SITE_INTEGRATION_PROVIDERS } from "../../src/constants/site-integrations";
import type { DashboardORPCClient } from "../../src/lib/orpc/client";
import {
  SITE_INTEGRATION_CLIENT_ID,
  SITE_INTEGRATION_PULL_REQUEST_URL,
} from "../constants/site-integration-dialog";

const calls: unknown[] = [];
Reflect.set(window, "integrationCalls", calls);
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const rpc = createORPCClient<DashboardORPCClient>({
  call: async (path, input) => {
    if (path.join(".") !== "sites.integrations.save") {
      throw new Error(`Unexpected RPC ${path.join(".")}`);
    }
    calls.push(input);
    return { pullRequestUrl: SITE_INTEGRATION_PULL_REQUEST_URL };
  },
});
export const dashboardOrpc = createTanstackQueryUtils(rpc, {
  path: ["dashboard"],
});

const provider = SITE_INTEGRATION_PROVIDERS.find(
  (entry) => entry.id === "databuddy"
);
const existing = new URLSearchParams(location.search).has("existing");

function Fixture() {
  if (!provider) {
    return null;
  }
  return (
    <IntlProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>
        <SiteIntegrationDialog
          onOpenChange={() => {}}
          open
          provider={provider}
          scope={{ organizationId: "org-synthetic", siteId: "site-synthetic" }}
          settings={
            existing
              ? { clientId: SITE_INTEGRATION_CLIENT_ID, trackWebVitals: true }
              : null
          }
        />
      </QueryClientProvider>
    </IntlProvider>
  );
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<Fixture />);
}
