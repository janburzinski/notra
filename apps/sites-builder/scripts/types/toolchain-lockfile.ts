/** A `packages` entry of bun.lock: `[name@version, registry, metadata, integrity]`. */
export type BunLockPackage =
  | [string]
  | [string, string, BunLockMetadata, string];

export interface BunLockMetadata {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalPeers?: string[];
  os?: string | string[];
  cpu?: string | string[];
  bin?: Record<string, string> | string;
  bundled?: boolean;
  hasInstallScript?: boolean;
}

export interface BunLock {
  workspaces: Record<string, { name?: string }>;
  overrides?: Record<string, string | Record<string, string>>;
  patchedDependencies?: Record<string, string>;
  packages: Record<string, BunLockPackage>;
}

/** A resolved package: its bun.lock key and `name@version`. */
export interface LockedPackage {
  key: string;
  name: string;
  version: string;
  metadata: BunLockMetadata;
  integrity: string;
}

export interface NpmLockEntry {
  name?: string;
  version?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: true }>;
  os?: string[];
  cpu?: string[];
  bin?: Record<string, string> | string;
  hasInstallScript?: true;
  inBundle?: true;
  optional?: true;
}
