import { PackageCommand } from "../../registry/notra/package-command/components/package-command";
import type { RegistryInstallProps } from "../types/registry-install";

export default function RegistryInstall({ name }: RegistryInstallProps) {
  return (
    <div className="my-6">
      <PackageCommand command={`npx shadcn@latest add @notra/${name}`} />
    </div>
  );
}
