export type GeoRecapTone = "up" | "down" | "neutral";

export interface GeoRecapChange {
  id: string;
  detail: string;
  tone: GeoRecapTone;
}

export interface GeoRecapItem {
  id: string;
  title: string;
  changes: GeoRecapChange[];
  engineLabel?: string;
  engineIconSrc?: string;
}

export interface GeoRecapCompetitor {
  name: string;
  shareLabel: string;
  deltaLabel: string;
  isOwnBrand?: boolean;
}

export interface GeoRecapAction {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  label: string;
}

export interface WeeklySummaryEmailProps {
  organizationName: string;
  organizationSlug: string;
  weekLabel: string;
  headline: string;
  /** Nothing moved; the email only confirms visibility held. */
  quiet: boolean;
  visibilityLabel: string;
  visibilityDeltaLabel: string;
  answersChecked: number;
  items: readonly GeoRecapItem[];
  remainingCount: number;
  competitors: readonly GeoRecapCompetitor[];
  /** Products added this week, most often found on the site by the weekly check. */
  newProducts?: readonly GeoRecapItem[];
  /** New products beyond the ones listed. */
  newProductsRemaining?: number;
  action?: GeoRecapAction;
  dashboardLink: string;
}

export interface VisibilityDropEmailProps {
  organizationName: string;
  organizationSlug: string;
  headline: string;
  previousLabel: string;
  currentLabel: string;
  deltaLabel: string;
  items: readonly GeoRecapItem[];
  remainingCount: number;
  dashboardLink: string;
}

export interface GeoAlertEmailProps {
  organizationName: string;
  organizationSlug: string;
  automationName: string;
  headline: string;
  summary: string;
  items: readonly GeoRecapItem[];
  remainingCount: number;
  dashboardLink: string;
}

/** A brand or assistant with its share of one scan's answers. */
export interface GeoRecapShareRow {
  name: string;
  shareLabel: string;
  iconSrc?: string;
  isOwnBrand?: boolean;
}

export interface FirstScanResultsEmailProps {
  organizationName: string;
  organizationSlug: string;
  brandName: string;
  visibilityLabel: string;
  answersChecked: number;
  promptCount: number;
  engines: readonly GeoRecapShareRow[];
  mentionedIn: readonly GeoRecapItem[];
  mentionedRemaining: number;
  competitors: readonly GeoRecapShareRow[];
  action?: GeoRecapAction;
  dashboardLink: string;
}
