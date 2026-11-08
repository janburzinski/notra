export interface GeoEngineChange {
  from: string;
  to: string | null;
}

export interface GeoEngineChangeEmailProps {
  organizationName: string;
  organizationSlug: string;
  effectiveDate: string;
  changes: GeoEngineChange[];
  codingAgents: boolean;
}
