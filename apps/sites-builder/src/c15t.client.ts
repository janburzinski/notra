import type { C15tClientOptionsExtension } from "@c15t/astro";
import { databuddy } from "@c15t/integrations/databuddy";
import { gtag } from "@c15t/integrations/google-tag";
import { plausibleAnalytics } from "@c15t/integrations/plausible-analytics";
import { posthog } from "@c15t/integrations/posthog";
import { umamiAnalytics } from "@c15t/integrations/umami-analytics";

import {
  dropSharedConsentCookie,
  migrateLegacyRefusal,
} from "./utils/consent-migration";

const analytics = __NOTRA_CONSENT_ANALYTICS__;
const onHostingDomain =
  __NOTRA_HOSTING_DOMAIN__ !== null &&
  `.${location.hostname}`.endsWith(`.${__NOTRA_HOSTING_DOMAIN__}`);

if (
  __NOTRA_HOSTING_DOMAIN__ !== null &&
  onHostingDomain &&
  __NOTRA_CONSENT_STORAGE_KEY__ === null
) {
  dropSharedConsentCookie(__NOTRA_HOSTING_DOMAIN__);
}
migrateLegacyRefusal(__NOTRA_CONSENT_STORAGE_KEY__);

export default {
  scripts: [
    ...(analytics.capless
      ? [
          {
            id: "capless",
            src: analytics.capless.scriptUrl,
            category: "measurement",
            async: true,
            attributes: { "data-key": analytics.capless.key },
          },
        ]
      : []),
    ...(analytics.databuddy
      ? [
          {
            ...databuddy({
              clientId: analytics.databuddy.clientId,
              scriptUrl: analytics.databuddy.scriptUrl,
              apiUrl: analytics.databuddy.apiUrl,
              replay: analytics.databuddy.replay,
              configWhenGranted: {
                ...analytics.databuddy.options,
                disabled: false,
              },
              configWhenDenied: {
                ...analytics.databuddy.options,
                disabled: true,
              },
            }),
            alwaysLoad: false,
          },
        ]
      : []),
    ...(analytics.datafast
      ? [
          {
            id: "datafast",
            src: analytics.datafast.src,
            category: "measurement",
            async: true,
            attributes: analytics.datafast.attributes,
          },
        ]
      : []),
    ...(analytics.gtag
      ? [
          gtag({
            id: analytics.gtag.id,
            category: "measurement",
            loadMode: "after-consent",
            config: onHostingDomain ? { cookie_domain: "none" } : undefined,
          }),
        ]
      : []),
    ...(analytics.posthog
      ? [
          posthog({
            id: analytics.posthog.id,
            apiHost: analytics.posthog.apiHost,
            loadMode: "after-consent",
            initOptions: {
              cookieless_mode: "never",
              disable_session_recording:
                analytics.posthog.disableSessionRecording,
              ...(onHostingDomain && { cross_subdomain_cookie: false }),
            },
          }),
        ]
      : []),
    ...(analytics.onedollarstats
      ? [
          {
            id: "onedollarstats",
            src: analytics.onedollarstats.src,
            category: "measurement",
            async: true,
            attributes: analytics.onedollarstats.attributes,
          },
        ]
      : []),
    ...(analytics.plausible ? [plausibleAnalytics(analytics.plausible)] : []),
    ...(analytics.rybbit
      ? [
          {
            id: "rybbit",
            src: analytics.rybbit.src,
            category: "measurement",
            async: true,
            attributes: analytics.rybbit.attributes,
          },
        ]
      : []),
    ...(analytics.simpleAnalytics
      ? [
          {
            id: "simple-analytics",
            src: analytics.simpleAnalytics.src,
            category: "measurement",
            async: true,
            attributes: analytics.simpleAnalytics.attributes,
          },
        ]
      : []),
    ...(analytics.umami ? [umamiAnalytics(analytics.umami)] : []),
  ],
} satisfies C15tClientOptionsExtension;
