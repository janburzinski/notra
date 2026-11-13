import { UPGRADES } from "@/constants/upgrades";
import type { UpgradeId, UpgradeSpec } from "@/types/game";

export function upgradeSpec(id: UpgradeId): UpgradeSpec {
  const spec = UPGRADES.find((upgrade) => upgrade.id === id);
  if (!spec) {
    throw new Error(`Unknown upgrade ${id}`);
  }
  return spec;
}
