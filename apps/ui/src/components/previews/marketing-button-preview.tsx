import { ArrowRight } from "lucide-react";

import { MarketingButton } from "../../../registry/notra/marketing-button/components/marketing-button";

export default function MarketingButtonPreview() {
  return (
    <div className="flex flex-col items-center gap-4">
      <MarketingButton>
        Start for free
        <ArrowRight />
      </MarketingButton>
      <MarketingButton variant="light">Book a call</MarketingButton>
    </div>
  );
}
