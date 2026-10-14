import { databuddy } from "@c15t/integrations/databuddy";

const databuddyClientId = import.meta.env.NEXT_PUBLIC_DATABUDDY_WEB_WEBSITE_ID;

export const consentScripts = databuddyClientId
  ? [
      databuddy({
        clientId: databuddyClientId,
        configWhenGranted: { disabled: false },
        configWhenDenied: { disabled: true },
      }),
    ]
  : [];
