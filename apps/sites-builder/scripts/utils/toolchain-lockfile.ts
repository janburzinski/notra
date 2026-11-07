import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  TOOLCHAIN_PACKAGE_NAME,
  TRAILING_COMMA,
} from "../constants/box-snapshot";
import type {
  BunLock,
  BunLockMetadata,
  LockedPackage,
  NpmLockEntry,
} from "../types/toolchain-lockfile";

function packageNames(key: string): string[] {
  const names: string[] = [];
  const parts = key.split("/");
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index] as string;
    names.push(part.startsWith("@") ? `${part}/${parts[++index]}` : part);
  }
  return names;
}

function nameOfSpec(spec: string): string {
  const at = spec.indexOf("@", 1);
  return at === -1 ? spec : spec.slice(0, at);
}

function list(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) {
    return;
  }
  return Array.isArray(value) ? value : [value];
}

function lockPath(names: string[]): string {
  return names.map((name) => `node_modules/${name}`).join("/");
}

function edges(metadata: BunLockMetadata) {
  const optionalPeers = new Set(metadata.optionalPeers ?? []);
  return [
    ...Object.keys(metadata.dependencies ?? {}).map((name) => ({
      name,
      optional: false,
      peer: false,
    })),
    ...Object.keys(metadata.optionalDependencies ?? {}).map((name) => ({
      name,
      optional: true,
      peer: false,
    })),
    ...Object.keys(metadata.peerDependencies ?? {})
      .filter((name) => !optionalPeers.has(name))
      .map((name) => ({ name, optional: false, peer: true })),
  ].sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * The npm lockfile for the snapshot's runtime dependencies, pinned to the
 * versions bun.lock resolved for this workspace, so the render fingerprint
 * and `npm ci` in the Box both follow bun.lock. Also returns the bun.lock
 * overrides that apply to those packages, which `npm ci` needs to accept
 * the same versions.
 */
export function toolchainLockfile(
  repoRoot: string,
  workspaceName: string,
  dependencies: Record<string, string>
) {
  const lock = JSON.parse(
    readFileSync(join(repoRoot, "bun.lock"), "utf8").replace(
      TRAILING_COMMA,
      (match, string: string | undefined, close: string | undefined) =>
        string ?? close ?? match
    )
  ) as BunLock;
  const patched = new Set(Object.keys(lock.patchedDependencies ?? {}));

  const resolve = (from: string[], name: string): LockedPackage | null => {
    for (let depth = from.length; depth >= 0; depth -= 1) {
      const key = [...from.slice(0, depth), name].join("/");
      const entry = lock.packages[key];
      if (!entry) {
        continue;
      }
      if (entry.length !== 4) {
        throw new Error(`${key} is not a registry package (${entry[0]})`);
      }
      const [spec, , metadata, integrity] = entry;
      if (patched.has(spec)) {
        throw new Error(`${spec} is patched, which npm can't reproduce`);
      }
      const at = spec.lastIndexOf("@");
      return {
        key,
        name: spec.slice(0, at),
        version: spec.slice(at + 1),
        metadata,
        integrity,
      };
    }
    return null;
  };

  const tree = new Map<string, LockedPackage>();
  const links = new Map<string, { path: string; optional: boolean }[]>();
  const queue: { names: string[]; locked: LockedPackage }[] = [];

  // npm resolves a package by walking up from its parent's node_modules, so
  // place each one as high as it can go without shadowing another version.
  const place = (from: string[], name: string, locked: LockedPackage) => {
    for (let depth = from.length; depth >= 0; depth -= 1) {
      const existing = tree.get(lockPath([...from.slice(0, depth), name]));
      if (!existing) {
        continue;
      }
      if (
        existing.name === locked.name &&
        existing.version === locked.version
      ) {
        return [...from.slice(0, depth), name];
      }
      if (depth === from.length) {
        throw new Error(`Conflicting versions of ${name} under ${from}`);
      }
      return insert([...from.slice(0, depth + 1), name], locked);
    }
    return insert([name], locked);
  };
  const find = (from: string[], name: string) => {
    for (let depth = from.length; depth >= 0; depth -= 1) {
      const at = [...from.slice(0, depth), name];
      if (tree.has(lockPath(at))) {
        return at;
      }
    }
    return null;
  };
  const insert = (names: string[], locked: LockedPackage) => {
    tree.set(lockPath(names), locked);
    queue.push({ names, locked });
    return names;
  };
  // A bundled package ships inside its owner's tarball, so it stays where
  // bun.lock has it relative to that owner.
  const bundle = (from: string[], depth: number, locked: LockedPackage) => {
    const ownerDepth =
      from.length - depth + packageNames(locked.key).length - 1;
    const name = packageNames(locked.key).at(-1) as string;
    const at = [...from.slice(0, ownerDepth), name];
    return tree.has(lockPath(at)) ? at : insert(at, locked);
  };
  const link = (from: string, names: string[], optional: boolean) => {
    links.set(from, [
      ...(links.get(from) ?? []),
      { path: lockPath(names), optional },
    ]);
  };

  for (const name of Object.keys(dependencies).sort()) {
    const locked = resolve([workspaceName], name);
    if (!locked) {
      throw new Error(`bun.lock has no ${name} for ${workspaceName}`);
    }
    link("", place([], name, locked), false);
  }
  for (let next = queue.shift(); next; next = queue.shift()) {
    const { names, locked } = next;
    const depth = packageNames(locked.key).length;
    for (const edge of edges(locked.metadata)) {
      const dependency = resolve(packageNames(locked.key), edge.name);
      if (!dependency) {
        if (edge.optional) {
          continue;
        }
        throw new Error(`bun.lock has no ${edge.name} for ${locked.key}`);
      }
      let target: string[];
      if (dependency.metadata.bundled) {
        target = bundle(names, depth, dependency);
      } else if (edge.peer) {
        // npm resolves a peer from the dependent's parent and keeps whatever
        // version is already there.
        const parent = names.slice(0, -1);
        target =
          find(parent, edge.name) ?? place(parent, edge.name, dependency);
      } else {
        target = place(names, edge.name, dependency);
      }
      link(lockPath(names), target, edge.optional);
    }
  }

  const required = new Set<string>();
  const pending = [""];
  for (let path = pending.pop(); path !== undefined; path = pending.pop()) {
    for (const edge of links.get(path) ?? []) {
      if (!(edge.optional || required.has(edge.path))) {
        required.add(edge.path);
        pending.push(edge.path);
      }
    }
  }

  const packages: Record<string, NpmLockEntry> = {
    "": { name: TOOLCHAIN_PACKAGE_NAME, dependencies },
  };
  const names = new Set<string>();
  for (const path of [...tree.keys()].sort()) {
    const locked = tree.get(path) as LockedPackage;
    const { metadata } = locked;
    names.add(locked.name);
    const optionalPeers = metadata.optionalPeers ?? [];
    packages[path] = {
      ...(path.endsWith(`node_modules/${locked.name}`)
        ? {}
        : { name: locked.name }),
      version: locked.version,
      ...(metadata.bundled
        ? { inBundle: true as const }
        : { integrity: locked.integrity }),
      dependencies: metadata.dependencies,
      optionalDependencies: metadata.optionalDependencies,
      peerDependencies: metadata.peerDependencies,
      peerDependenciesMeta: optionalPeers.length
        ? Object.fromEntries(
            optionalPeers.map((name) => [name, { optional: true as const }])
          )
        : undefined,
      os: list(metadata.os),
      cpu: list(metadata.cpu),
      bin: metadata.bin,
      hasInstallScript: metadata.hasInstallScript ? true : undefined,
      optional: required.has(path) ? undefined : true,
    };
  }
  // npm rejects an override of a direct dependency unless it points at it.
  const overrides = Object.fromEntries(
    Object.entries(lock.overrides ?? {})
      .filter(([spec]) => names.has(nameOfSpec(spec)))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([spec, version]) => {
        const name = nameOfSpec(spec);
        return [spec, name in dependencies ? `$${name}` : version];
      })
  );
  return {
    lockfile: {
      name: TOOLCHAIN_PACKAGE_NAME,
      lockfileVersion: 3,
      requires: true,
      packages,
    },
    overrides,
  };
}
