import type { PACKAGE_MANAGERS } from "../constants/package-command";

export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

export type PackageCommands = Record<PackageManager, string>;

export interface PackageCommandProps {
  command: string;
  className?: string;
}

export interface PackageManagerIconProps {
  manager: PackageManager;
}

export type CopyStatus = "idle" | "copied" | "failed";
