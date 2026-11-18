import { useTranslations } from "use-intl";

import { MockFrame } from "@/components/landing/mock-frame";
import { ShareOfVoiceRows } from "@/components/landing/share-of-voice-rows";
import { FEATURES_SHARE_ROWS } from "@/constants/landing/features";

export function FeaturesCardShare() {
  const t = useTranslations("landing.features.share");
  return (
    <MockFrame heading={t("heading")} subhead={t("subhead")}>
      <ShareOfVoiceRows
        headers={{
          brand: t("headers.brand"),
          share: t("headers.share"),
          mentions: t("headers.mentions"),
        }}
        rows={FEATURES_SHARE_ROWS}
      />
    </MockFrame>
  );
}
