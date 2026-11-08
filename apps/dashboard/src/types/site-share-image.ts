import type {
  SITE_SHARE_PREVIEW_PAGES,
  SITE_THUMBNAIL_APPEARANCES,
  SITE_THUMBNAIL_LAYOUTS,
} from "@/constants/site-share-image";
import type { useSiteSharePreview } from "@/lib/hooks/use-site-share-preview";
import type { SiteDesignForm } from "@/types/site-design";

export type SiteThumbnailLayout = (typeof SITE_THUMBNAIL_LAYOUTS)[number];
export type SiteThumbnailAppearance =
  (typeof SITE_THUMBNAIL_APPEARANCES)[number];
export type SiteSharePreviewPage = (typeof SITE_SHARE_PREVIEW_PAGES)[number];

/** Settings the build skips with a warning, so the preview draws without them too. */
export type SiteSharePreviewWarning = "background" | "font";

export interface SiteSharePreview {
  /** Data URL of the image, or the home page image's https URL; null when there's nothing to show. */
  image: string | null;
  warnings: SiteSharePreviewWarning[];
}

export interface SiteSharePreviewInput {
  branch?: string;
  config: string;
  page: SiteSharePreviewPage;
}

export interface SiteThumbnailLayoutSketchProps {
  layout: SiteThumbnailLayout;
  appearance: SiteThumbnailAppearance;
  accent: string;
}

export interface SiteSharePreviewProps {
  form: SiteDesignForm;
}

export interface SiteSharePreviewBodyProps {
  form: SiteDesignForm;
  preview: ReturnType<typeof useSiteSharePreview>;
}

export interface SiteSharePreviewWarningsProps {
  warnings: readonly SiteSharePreviewWarning[];
}

export interface SiteSharePreviewImageProps {
  src: string;
  alt: string;
}
