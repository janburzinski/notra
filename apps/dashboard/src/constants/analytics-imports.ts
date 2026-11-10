import { Clock01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import type {
  AnalyticsImportProvider,
  AnalyticsImportStatus,
} from "@notra/db/types/analytics-imports";
import type { StatusBadgeAppearance } from "@notra/ui/types/status-badge";

import type { AnalyticsImportProviderChoice } from "@/types/components/analytics-import";

export const ANALYTICS_IMPORT_MAX_CHUNK_ATTEMPTS = 3;
export const ANALYTICS_IMPORT_MAX_ERROR_LENGTH = 500;
/** Shortest key or token the connect form submits; the server checks each provider's own. */
export const ANALYTICS_IMPORT_MIN_SECRET_LENGTH = 10;
export const ANALYTICS_IMPORT_MIN_HOST_LENGTH = 3;
/** Stored as an import's error; the import list shows it translated. */
export const ANALYTICS_IMPORT_FLAG_OFF_ERROR =
  "Web analytics was turned off for this workspace";
export const ANALYTICS_IMPORT_FLAG_UNAVAILABLE_ERROR =
  "Could not check whether web analytics is available for this workspace";
/** Written by the recovery job when an import's run was lost too often. */
export const ANALYTICS_IMPORT_LOST_ERROR =
  "The import stopped and could not be resumed";
/** Written by the recovery job when an export held in memory was lost with its process. */
export const ANALYTICS_IMPORT_LOST_UPLOAD_ERROR =
  "The import stopped before it finished reading the export";
/** Translation keys for errors the runner itself writes. */
export const ANALYTICS_IMPORT_KNOWN_ERRORS: Readonly<
  Record<string, "flagOff" | "flagUnavailable" | "lost" | "lostUpload">
> = {
  [ANALYTICS_IMPORT_FLAG_OFF_ERROR]: "flagOff",
  [ANALYTICS_IMPORT_FLAG_UNAVAILABLE_ERROR]: "flagUnavailable",
  [ANALYTICS_IMPORT_LOST_ERROR]: "lost",
  [ANALYTICS_IMPORT_LOST_UPLOAD_ERROR]: "lostUpload",
};
/** How long a queued import sleeps before it checks again; the import before it wakes it sooner. */
export const ANALYTICS_IMPORT_QUEUE_POLL_SECONDS = 300;
/** An active import untouched this long gets its workflow run checked. */
export const ANALYTICS_IMPORT_STALE_MS = 15 * 60 * 1000;
/** Restarts of a lost run before the import fails. */
export const ANALYTICS_IMPORT_MAX_RECOVERY_ATTEMPTS = 3;
/** Stale imports one recovery pass looks at. */
export const ANALYTICS_IMPORT_RECOVERY_BATCH = 50;
/** Per organization and action (connect, start, upload). */
export const ANALYTICS_IMPORT_RATE_LIMIT_PER_HOUR = 20;
export const ANALYTICS_IMPORT_UPLOAD_URL_TTL_SECONDS = 15 * 60;
/** Uploads through the dashboard request when no object storage is configured (local dev). */
export const ANALYTICS_IMPORT_INLINE_MAX_BYTES = 50 * 1024 * 1024;
/** Error data of a problem with the uploaded export, shown under the file field. */
export const ANALYTICS_IMPORT_FILE_ERROR_DATA = { field: "file" } as const;
export const ANALYTICS_IMPORT_POLL_MS = 3000;
/** Shorter import periods are described in days, longer ones in months. */
export const ANALYTICS_IMPORT_SPAN_MIN_MONTH_DAYS = 60;
export const ANALYTICS_IMPORT_AVERAGE_MONTH_DAYS = 30.44;
/** localStorage key of imports whose completion was already announced. */
export const ANALYTICS_IMPORT_NOTICE_STORAGE_KEY =
  "notra:analytics-import-notices";
export const ANALYTICS_IMPORT_NOTICE_STORAGE_MAX = 50;
export const ANALYTICS_IMPORT_UPLOAD_PREFIX = "analytics-imports";
/** Uploads no running import reads are swept once they are this old. */
export const ANALYTICS_IMPORT_UPLOAD_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Keys per database lookup when the sweep checks which uploads are still read. */
export const ANALYTICS_IMPORT_UPLOAD_SWEEP_BATCH = 500;
/** Domain label for deriving an upload's SSE-C key from INTEGRATION_ENCRYPTION_KEY. */
export const ANALYTICS_IMPORT_UPLOAD_KEY_LABEL = "analytics-import-upload";
/** Prefix of an export's source ref; the rest is a hash of the ZIP's content. */
export const ANALYTICS_IMPORT_CSV_REF = "plausible-export";
/** Hex digits of the export's SHA-256 kept in its source ref. */
export const ANALYTICS_IMPORT_CSV_HASH_LENGTH = 32;
export const ANALYTICS_IMPORT_ACTIVE_SOURCE_INDEX =
  "analyticsImports_active_source_uidx";
export const ANALYTICS_IMPORT_ZIP_MIME = "application/zip";

export const ANALYTICS_IMPORT_PROVIDER_ORDER = [
  "plausible_csv",
  "plausible",
  "cloudflare",
  "vercel",
  "rybbit",
  "databuddy",
] as const;

export const ANALYTICS_IMPORT_PROVIDER_LABELS: Record<
  AnalyticsImportProvider,
  string
> = {
  plausible: "Plausible",
  plausible_csv: "Plausible export",
  vercel: "Vercel Web Analytics",
  cloudflare: "Cloudflare",
  cloudflare_rum: "Cloudflare Web Analytics",
  rybbit: "Rybbit",
  databuddy: "Databuddy",
};

/** Brand names for "Connect …", "Open …" and the chart's import marker. */
export const ANALYTICS_IMPORT_PROVIDER_BRANDS: Record<
  AnalyticsImportProvider,
  string
> = {
  plausible: "Plausible",
  plausible_csv: "Plausible",
  vercel: "Vercel",
  cloudflare: "Cloudflare",
  cloudflare_rum: "Cloudflare",
  rybbit: "Rybbit",
  databuddy: "Databuddy",
};

/** Where the first guide step sends people to export or create a key. */
export const ANALYTICS_IMPORT_PROVIDER_URLS = {
  plausible_csv: "https://plausible.io/sites",
  plausible: "https://plausible.io/settings/api-keys",
  cloudflare: "https://dash.cloudflare.com/profile/api-tokens",
  vercel: "https://vercel.com/account/settings/tokens",
  rybbit: "https://app.rybbit.io",
  databuddy: "https://app.databuddy.cc/organizations/settings#api-keys",
} as const satisfies Record<AnalyticsImportProviderChoice, string>;

/** Labels exactly as Cloudflare's custom token form shows them. */
export const ANALYTICS_IMPORT_CLOUDFLARE_PERMISSIONS = [
  "Zone → Analytics → Read",
  "Zone → Zone → Read",
  "Account → Account Analytics → Read",
  "Account → Account Settings → Read",
] as const;

/** Completed imports carry no badge; their totals say enough. */
/** Same badges as automation runs: work in progress spins. */
export const ANALYTICS_IMPORT_STATUS_BADGES: Partial<
  Record<AnalyticsImportStatus, StatusBadgeAppearance>
> = {
  pending: { variant: "secondary", icon: Clock01Icon },
  running: { variant: "info", icon: Loading03Icon, spin: true },
  waiting_rate_limit: { variant: "warning", icon: Clock01Icon },
  failed: { variant: "destructive" },
  deleting: { variant: "secondary", icon: Loading03Icon, spin: true },
};

export const ANALYTICS_IMPORT_ZIP_ACCEPT = {
  [ANALYTICS_IMPORT_ZIP_MIME]: [".zip"],
  "application/x-zip-compressed": [".zip"],
};
