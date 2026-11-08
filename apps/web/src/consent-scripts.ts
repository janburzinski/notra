import { databuddy } from "@c15t/integrations/databuddy";

import { DUB_ANALYTICS_SCRIPT } from "@/constants/dub";
import { notraAnalyticsScript } from "@/utils/notra-analytics";

const databuddyClientId = import.meta.env.NEXT_PUBLIC_DATABUDDY_WEB_WEBSITE_ID;
const notraWebKey = import.meta.env.NEXT_PUBLIC_NOTRA_WEB_KEY;

export const consentScripts = [
  DUB_ANALYTICS_SCRIPT,
  ...(databuddyClientId
    ? [
        databuddy({
          clientId: databuddyClientId,
          configWhenGranted: { disabled: false },
          configWhenDenied: { disabled: true },
        }),
      ]
    : []),
  ...(notraWebKey ? [notraAnalyticsScript(notraWebKey)] : []),
];
