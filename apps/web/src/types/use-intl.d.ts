import type { LandingLocale } from "@/types/i18n";

import type messages from "../../messages/en.json";

declare module "use-intl" {
  interface AppConfig {
    Locale: LandingLocale;
    Messages: typeof messages;
  }
}
