export interface LandingFlags {
  enrolled: boolean;
  heroVariant: string;
  testimonials: boolean;
}

export interface LandingPageProps {
  flags: LandingFlags;
}

export interface HeroSectionProps {
  enrolled: boolean;
  flagVariant: string;
}
