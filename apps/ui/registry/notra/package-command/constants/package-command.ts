export const PACKAGE_MANAGERS = ["bun", "pnpm", "yarn", "npm"] as const;

export const DEFAULT_PACKAGE_MANAGER = "bun";

export const PACKAGE_MANAGER_STORAGE_KEY = "notra-package-manager";

export const PACKAGE_COMMAND_COPIED_MS = 1500;

export const PACKAGE_COMMAND_COPY_LABELS = {
  idle: "Copy command",
  copied: "Copied",
  failed: "Copy failed",
} as const;
