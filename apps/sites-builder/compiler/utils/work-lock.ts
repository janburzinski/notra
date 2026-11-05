import { randomUUID } from "node:crypto";
import { link, mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { UsageError } from "./usage-error";

interface LockOwner {
  pid: number;
  ino: number;
}

function isRunning(pid: number): boolean {
  // An empty or garbled lock (or pid 0, which would mean "my process group") has no owner.
  if (!(Number.isInteger(pid) && pid > 0)) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: the process exists but belongs to another user.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Creates `path` holding this process's PID, or returns null if it exists.
 * The PID is written to a private file first and hard-linked into place, so
 * the lock is never visible without its owner.
 */
async function publish(path: string): Promise<number | null> {
  const draft = `${path}.${process.pid}.${randomUUID()}`;
  await writeFile(draft, String(process.pid));
  try {
    await link(draft, path);
    return (await stat(draft)).ino;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return null;
    }
    throw error;
  } finally {
    await rm(draft, { force: true });
  }
}

/** Who holds `path`: PID and inode read from the same open file. */
async function ownerOf(path: string): Promise<LockOwner | null> {
  const handle = await open(path, "r").catch(() => null);
  if (!handle) {
    return null;
  }
  try {
    const [{ ino }, text] = await Promise.all([
      handle.stat(),
      handle.readFile("utf8"),
    ]);
    return { pid: Number(text), ino };
  } finally {
    await handle.close();
  }
}

async function removeIfStill(path: string, ino: number) {
  if ((await ownerOf(path))?.ino === ino) {
    await rm(path, { force: true });
  }
}

/**
 * Removes a lock whose owner has exited. Takeovers run one at a time under a
 * second lock and only delete the very file found stale, so a build that
 * locked in the meantime keeps its lock.
 */
async function clearStale(lockPath: string, stale: LockOwner) {
  const guard = `${lockPath}.takeover`;
  const guardIno = await publish(guard);
  if (guardIno === null) {
    const holder = await ownerOf(guard);
    // A takeover takes milliseconds; a guard whose owner exited is left over from a crash.
    if (holder && !isRunning(holder.pid)) {
      await removeIfStill(guard, holder.ino);
    }
    return;
  }
  try {
    await removeIfStill(lockPath, stale.ino);
  } finally {
    await removeIfStill(guard, guardIno);
  }
}

/**
 * Builds share one work folder (Tailwind reads site sources from it), so two
 * at once would overwrite each other's files. The lock makes the second build
 * stop with a clear message; a lock left by a crashed build is taken over.
 */
export async function lockWorkDir(
  lockPath: string
): Promise<() => Promise<void>> {
  await mkdir(dirname(lockPath), { recursive: true });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ino = await publish(lockPath);
    if (ino !== null) {
      return () => removeIfStill(lockPath, ino);
    }
    const owner = await ownerOf(lockPath);
    if (owner && isRunning(owner.pid)) {
      throw new UsageError(
        `Another Notra Sites build (process ${owner.pid}) is running with this toolchain. Wait for it to finish, then build again. If none is running, delete ${lockPath}.`
      );
    }
    if (owner) {
      await clearStale(lockPath, owner);
    }
  }
  throw new UsageError(
    `Couldn't lock the build folder. Try the build again, or delete ${lockPath} if no build is running.`
  );
}
