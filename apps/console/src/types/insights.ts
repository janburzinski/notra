interface InsightsRangeOption {
  value: number;
  label: string;
}

export interface InsightsPageHeaderProps {
  title: string;
  description: string;
  options: readonly InsightsRangeOption[];
  days: number;
  onDaysChange: (days: number) => void;
}
