export interface DashboardBannerContent {
  id: string;
  message: string;
  action?: { label: string; href: string };
  dismissible?: boolean;
}

export interface DashboardBannerProps {
  message: string;
  action?: { label: string; href: string };
  dismissLabel?: string;
  onDismiss?: () => void;
}
