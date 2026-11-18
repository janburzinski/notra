import { PackageCommand } from "../components/package-command";

export default function PackageCommandDemo() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-4 sm:p-6">
      <PackageCommand command="npx shadcn@latest add @notra/package-command" />
      <PackageCommand command="npm install @usenotra/sdk" />
    </div>
  );
}
