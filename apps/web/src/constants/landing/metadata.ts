import { LANDING_HOME_PATHS } from "@/constants/i18n";
import type { Metadata } from "@/types/metadata";
import {
  pageAlternates,
  ROOT_METADATA,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "@/utils/metadata";
import { SITE_URL } from "@/utils/urls";

const LANDING_LANGUAGES = {
  en: LANDING_HOME_PATHS.en,
  de: LANDING_HOME_PATHS.de,
  "x-default": LANDING_HOME_PATHS.en,
};

export const LANDING_PAGE_METADATA: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: {
    ...pageAlternates(SITE_URL),
    languages: LANDING_LANGUAGES,
  },
};

const SITE_TITLE_DE = "Notra. Werde von KI-Engines empfohlen.";

const SITE_DESCRIPTION_DE =
  "Notra ist ein GEO-Tool, das ChatGPT, Claude und Gemini die Fragen stellt, die deine Käufer stellen. Du siehst, ob du in den Antworten vorkommst, wer stattdessen genannt wird und wie du das änderst.";

export const LANDING_PAGE_METADATA_DE: Metadata = {
  title: { absolute: SITE_TITLE_DE },
  description: SITE_DESCRIPTION_DE,
  alternates: {
    canonical: `${SITE_URL}${LANDING_HOME_PATHS.de}`,
    languages: LANDING_LANGUAGES,
  },
  openGraph: {
    ...ROOT_METADATA.openGraph,
    locale: "de_DE",
    url: LANDING_HOME_PATHS.de,
    title: SITE_TITLE_DE,
    description: SITE_DESCRIPTION_DE,
  },
  twitter: {
    ...ROOT_METADATA.twitter,
    title: SITE_TITLE_DE,
    description: SITE_DESCRIPTION_DE,
  },
};
