import type {
  SiteIntegrationName,
  SiteIntegrations,
} from "@notra/sites-core/types/site-integrations";
import type { ComponentType, SVGProps } from "react";

interface SiteIntegrationField<Key extends string = string> {
  key: Key;
  placeholder?: string;
  optional?: boolean;
  type?: "text" | "boolean";
  defaultValue?: boolean;
}

export type SiteIntegrationProvider = {
  [Id in SiteIntegrationName]: {
    id: Id;
    name: string;
    logo: ComponentType<SVGProps<SVGSVGElement>> | null;
    docsUrl: string;
    recommended?: boolean;
    fields: readonly SiteIntegrationField<
      keyof NonNullable<SiteIntegrations[Id]> & string
    >[];
  };
}[SiteIntegrationName];

export type SiteIntegrationValues = Record<string, string | boolean>;

export interface SiteIntegrationSaveResult {
  action: "save" | "remove";
  /** Null when blog.json already held the change. */
  pullRequestUrl: string | null;
}
