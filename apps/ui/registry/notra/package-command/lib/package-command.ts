import {
  DEFAULT_PACKAGE_MANAGER,
  PACKAGE_MANAGER_STORAGE_KEY,
  PACKAGE_MANAGERS,
} from "../constants/package-command";
import type { PackageCommands, PackageManager } from "../types/package-command";

const listeners = new Set<() => void>();
let selected: PackageManager | undefined;

function storage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function onStorage() {
  selected = undefined;
  notify();
}

export function toPackageManager(value: unknown): PackageManager | undefined {
  return PACKAGE_MANAGERS.find((manager) => manager === value);
}

export function readPackageManager(): PackageManager {
  return (
    selected ??
    toPackageManager(storage()?.getItem(PACKAGE_MANAGER_STORAGE_KEY)) ??
    DEFAULT_PACKAGE_MANAGER
  );
}

function persist(manager: PackageManager) {
  try {
    storage()?.setItem(PACKAGE_MANAGER_STORAGE_KEY, manager);
    return true;
  } catch {
    return false;
  }
}

export function writePackageManager(manager: PackageManager) {
  selected = manager;
  persist(manager);
  notify();
}

export function subscribePackageManager(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function convertNpmCommand(command: string): PackageCommands {
  const swap = (from: string, to: Omit<PackageCommands, "npm">) => ({
    bun: command.replace(from, to.bun),
    pnpm: command.replace(from, to.pnpm),
    yarn: command.replace(from, to.yarn),
    npm: command,
  });

  if (command.startsWith("npm install")) {
    return swap("npm install", {
      bun: "bun add",
      pnpm: "pnpm add",
      yarn: "yarn add",
    });
  }
  if (command.startsWith("npx create-")) {
    return swap("npx create-", {
      bun: "bun create ",
      pnpm: "pnpm create ",
      yarn: "yarn create ",
    });
  }
  if (command.startsWith("npm create")) {
    return swap("npm create", {
      bun: "bun create",
      pnpm: "pnpm create",
      yarn: "yarn create",
    });
  }
  if (command.startsWith("npx")) {
    return swap("npx", {
      bun: "bunx --bun",
      pnpm: "pnpm dlx",
      yarn: "yarn dlx",
    });
  }
  if (command.startsWith("npm run")) {
    return swap("npm run", { bun: "bun run", pnpm: "pnpm", yarn: "yarn" });
  }
  return { bun: command, pnpm: command, yarn: command, npm: command };
}
