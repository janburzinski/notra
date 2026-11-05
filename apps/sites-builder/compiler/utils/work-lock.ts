import { randomUUID } from "node:crypto";
import { link, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { UsageError } from "./usage-error";

interface LockOwner {
  pid: number;
  // The lock's whole contents. A new lock can reuse a deleted one's inode
  // number (ext4 hands the freed number straight back), so the owner is told
  // apart by a token only it wrote.
  token: string;
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
 * Creates `path` holding this process's PID and a random token, or returns
 * null if it exists. The contents are written to a private file first and
 * hard-linked into place, so the lock is never visible without its owner.
 */
async function publish(path: string): Promise<string | null> {
  const token = `${process.pid} ${randomUUID()}`;
  const draft = `${path}.${process.pid}.${randomUUID()}`;
  await writeFile(draft, token);
  try {
    await link(draft, path);
    return token;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      return null;
    }
    throw error;
  } finally {
    await rm(draft, { force: true });
  }
}

/** Who holds `path`: the PID and token it was published with. */
async function ownerOf(path: string): Promise<LockOwner | null> {
  const token = await readFile(path, "utf8").catch(() => null);
  if (token === null) {
    return null;
  }
  // Locks from before the token hold only a PID.
  return { pid: Number(token.split(" ")[0]), token };
}

async function removeIfStill(path: string, token: string) {
  if ((await ownerOf(path))?.token === token) {
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
  const guardToken = await publish(guard);
  if (guardToken === null) {
    const holder = await ownerOf(guard);
    // A takeover takes milliseconds; a guard whose owner exited is left over from a crash.
    if (holder && !isRunning(holder.pid)) {
      await removeIfStill(guard, holder.token);
    }
    return;
  }
  try {
    await removeIfStill(lockPath, stale.token);
  } finally {
    await removeIfStill(guard, guardToken);
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
    const token = await publish(lockPath);
    if (token !== null) {
      return () => removeIfStill(lockPath, token);
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
