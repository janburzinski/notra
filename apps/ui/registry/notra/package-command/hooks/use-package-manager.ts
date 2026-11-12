"use client";

import { useSyncExternalStore } from "react";

import { DEFAULT_PACKAGE_MANAGER } from "../constants/package-command";
import {
  readPackageManager,
  subscribePackageManager,
} from "../lib/package-command";

export function usePackageManager() {
  return useSyncExternalStore(
    subscribePackageManager,
    readPackageManager,
    () => DEFAULT_PACKAGE_MANAGER
  );
}
