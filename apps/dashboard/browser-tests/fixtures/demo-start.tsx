import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";

import messages from "../../messages/en.json";
import { DemoStart } from "../../src/components/demo/demo-start";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Demo start fixture root missing");
}

createRoot(root).render(
  <StrictMode>
    <IntlProvider locale="en" messages={{ demo: messages.demo }}>
      <DemoStart
        returnTo="/finished"
        turnstileSiteKey={
          location.search.includes("unconfigured") ? null : "synthetic-site-key"
        }
      />
    </IntlProvider>
  </StrictMode>
);
