import { StatusBadge } from "@notra/ui/components/status-badge";
import { TrendBadge } from "@notra/ui/components/trend-badge";

export default function BadgesPreview() {
  return (
    <div className="flex max-w-60 flex-wrap justify-center gap-2">
      <StatusBadge appearance={{ variant: "success" }} label="Successful" />
      <StatusBadge appearance={{ variant: "info" }} label="Queued" />
      <StatusBadge appearance={{ variant: "warning" }} label="Building" />
      <StatusBadge appearance={{ variant: "destructive" }} label="Failed" />
      <TrendBadge tone="up">+12.4%</TrendBadge>
      <TrendBadge tone="down">−3.2%</TrendBadge>
      <TrendBadge tone="flat">0%</TrendBadge>
    </div>
  );
}
