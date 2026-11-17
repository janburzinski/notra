"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  ITERATE_DRAFTS,
  ITERATE_IDEA_PLANS,
  ITERATE_PLAN_REVISIONS,
  ITERATE_POSTS,
  ITERATE_REVISIONS,
  type IterateIdeaPlan,
  type IterateRevision,
} from "./fixtures";

export interface PostVersion {
  number: number;
  /** When it was written, which is what the version menu shows. */
  createdAt: Date;
  title: string;
  description: string;
  blocks: string[];
  /** Indexes of blocks this version changed or added. */
  changed: number[];
  /**
   * What each changed block replaced, by its index in this version; null
   * for a block that is new. The diff shows it struck through above.
   */
  before: Record<number, string | null>;
  /** The title this version replaced, when it changed it. */
  titleBefore: string | null;
  /** What was asked for; empty for the first draft. */
  request: string | null;
  note: string | null;
  /**
   * The commit on the pull request's branch that holds this version. Every
   * request is pushed as a commit, so the pull request is always what you
   * see; there is no separate save.
   */
  commit: string;
}

/** A short, stable stand-in for a commit SHA; the real one comes from GitHub. */
function fakeCommit(seed: string) {
  let hash = 2_166_136_261;
  for (const char of seed) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}

interface QueuedRequest {
  id: string;
  request: string;
  quote: string | null;
}

interface PostThreadEntry {
  id: string;
  request: string;
  quote: string | null;
  /** The version it produced, once it's done. */
  version: number | null;
}

interface PostState {
  versions: PostVersion[];
  thread: PostThreadEntry[];
  /** The version on screen; the latest unless one is picked. */
  viewing: number;
}

/** Long enough to close the post and start on another meanwhile. */
const WORK_MS = 9000;
/** Between queued requests: long enough to read the result and undo it. */
const QUEUE_GAP_MS = 2500;
/** Writing an idea's first draft takes a little longer than a revision. */
export const WRITE_MS = 11000;

/** Re-planning an idea is quicker than writing it. */
const PLAN_MS = 5000;

/** An idea's plan as it is now, and the one before the latest change. */
export interface PlanState {
  current: IterateIdeaPlan;
  previous: IterateIdeaPlan | null;
  version: number;
  note: string | null;
}

/** An idea being written: when it started and how it was steered. */
export interface PostWrite {
  startedAt: number;
  direction: string | null;
}

/** A copy of `record` without `key`. */
function withoutKey<T>(record: Record<string, T>, key: string) {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

function applyRevision(
  previous: PostVersion,
  revision: IterateRevision,
  request: string
): PostVersion {
  const blocks: string[] = [];
  const changed: number[] = [];
  const before: Record<number, string | null> = {};
  previous.blocks.forEach((block, index) => {
    const replacement = revision.replace[index];
    if (replacement === null) {
      return;
    }
    if (replacement !== undefined) {
      before[blocks.length] = block;
      changed.push(blocks.length);
      blocks.push(replacement);
    } else {
      blocks.push(block);
    }
    for (const inserted of revision.insertAfter?.[index] ?? []) {
      before[blocks.length] = null;
      changed.push(blocks.length);
      blocks.push(inserted);
    }
  });
  const title = revision.title ?? previous.title;
  return {
    number: previous.number + 1,
    createdAt: new Date(),
    commit: fakeCommit(`${previous.commit}-${request}-${Date.now()}`),
    title,
    description: previous.description,
    blocks,
    changed,
    before,
    titleBefore: title === previous.title ? null : previous.title,
    request,
    note: revision.note,
  };
}

function firstVersion(findingId: string): PostVersion | null {
  const post = ITERATE_POSTS[findingId];
  if (!post) {
    return null;
  }
  return {
    number: 1,
    // Autopilot wrote the first draft this morning.
    createdAt: new Date("2026-11-16T07:42:00Z"),
    commit: fakeCommit(findingId),
    title: post.title,
    description: post.description,
    blocks: post.blocks,
    changed: [],
    before: {},
    titleBefore: null,
    request: null,
    note: null,
  };
}

/**
 * Every post's versions and requests, kept for the whole playground so
 * switching layouts or items keeps what was asked. Each request takes about
 * two seconds and answers with the next scripted revision.
 */
export function usePostRevisions({
  onFinished,
}: {
  /** A request finished; the host tells you if you're looking elsewhere. */
  onFinished?: (findingId: string, version: PostVersion) => void;
} = {}) {
  const [posts, setPosts] = useState<Record<string, PostState>>({});
  // When each running request started, by item; absent while idle. Every
  // item runs its own, so several posts can change at once.
  const [working, setWorking] = useState<Record<string, number>>({});
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const onFinishedRef = useRef(onFinished);
  const postsRef = useRef(posts);
  const writesRef = useRef<Record<string, PostWrite>>({});
  const workingRef = useRef(working);
  // Asked while that post was busy: sent in order once it's free, like the
  // chat's queued messages.
  const queues = useRef<Record<string, QueuedRequest[]>>({});
  // The same queue as state, so the composer can show it.
  const [queued, setQueued] = useState<Record<string, QueuedRequest[]>>({});
  // Ideas being written, and the ones that have a pull request now.
  const [writes, setWrites] = useState<Record<string, PostWrite>>({});
  const [written, setWritten] = useState<Record<string, number>>({});
  // Plans changed by request, and the ones being changed right now.
  const [plans, setPlans] = useState<Record<string, PlanState>>({});
  const [planning, setPlanning] = useState<Record<string, number>>({});
  const plansRef = useRef<Record<string, PlanState>>({});
  const syncQueue = useCallback((findingId: string) => {
    const list = [...(queues.current[findingId] ?? [])];
    setQueued((all) => ({ ...all, [findingId]: list }));
  }, []);
  useEffect(() => {
    onFinishedRef.current = onFinished;
    postsRef.current = posts;
    workingRef.current = working;
  }, [onFinished, posts, working]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending) {
        clearTimeout(timer);
      }
    };
  }, []);

  const stateFor = useCallback(
    (findingId: string): PostState | null => {
      const existing = posts[findingId];
      if (existing) {
        return existing;
      }
      const first = firstVersion(findingId);
      return first ? { versions: [first], thread: [], viewing: 1 } : null;
    },
    [posts]
  );

  // The queue starts its next request through the latest `ask`.
  const askRef = useRef<
    | ((
        findingId: string,
        request: string,
        quote: string | null,
        fromQueue?: boolean
      ) => void)
    | null
  >(null);
  const ask = useCallback(
    (
      findingId: string,
      request: string,
      quote: string | null,
      /** It just came off the front of the queue: it's its turn. */
      fromQueue = false
    ) => {
      const state = postsRef.current[findingId] ?? stateFor(findingId);
      if (!state) {
        return;
      }
      // Busy, or between queued requests: wait in line, in order.
      if (
        workingRef.current[findingId] !== undefined ||
        (!fromQueue && (queues.current[findingId]?.length ?? 0) > 0)
      ) {
        queues.current[findingId] = [
          ...(queues.current[findingId] ?? []),
          { id: `${findingId}-q-${Date.now()}`, request, quote },
        ];
        syncQueue(findingId);
        return;
      }
      workingRef.current = { ...workingRef.current, [findingId]: Date.now() };
      const entryId = `${findingId}-${state.thread.length}`;
      setPosts((all) => ({
        ...all,
        [findingId]: {
          ...state,
          thread: [
            ...state.thread,
            { id: entryId, request, quote, version: null },
          ],
        },
      }));
      setWorking((all) => ({ ...all, [findingId]: Date.now() }));
      const timer = setTimeout(() => {
        timers.current.delete(timer);
        setWorking((all) => withoutKey(all, findingId));
        workingRef.current = withoutKey(workingRef.current, findingId);
        // Read the latest state from the ref, not a stale closure: other
        // requests may have changed it while this one ran.
        const current = postsRef.current[findingId] ?? state;
        const latest = current.versions.at(-1);
        const script = ITERATE_REVISIONS[findingId] ?? [];
        const revision = script[(current.versions.length - 1) % script.length];
        if (!(latest && revision)) {
          return;
        }
        const next = applyRevision(latest, revision, request);
        setPosts((all) => {
          const now = all[findingId] ?? current;
          return {
            ...all,
            [findingId]: {
              versions: [...now.versions, next],
              thread: now.thread.map((entry) =>
                entry.id === entryId
                  ? { ...entry, version: next.number }
                  : entry
              ),
              viewing: next.number,
            },
          };
        });
        postsRef.current = {
          ...postsRef.current,
          [findingId]: {
            ...current,
            versions: [...current.versions, next],
            viewing: next.number,
          },
        };
        onFinishedRef.current?.(findingId, next);
        // The next queued request waits a moment, so this version gets its
        // own "ready" card and a chance to be undone before work goes on.
        if ((queues.current[findingId]?.length ?? 0) > 0) {
          const gap = setTimeout(() => {
            timers.current.delete(gap);
            const nextUp = queues.current[findingId]?.shift();
            if (nextUp) {
              syncQueue(findingId);
              askRef.current?.(findingId, nextUp.request, nextUp.quote, true);
            }
          }, QUEUE_GAP_MS);
          timers.current.add(gap);
        }
      }, WORK_MS);
      timers.current.add(timer);
    },
    [stateFor, syncQueue]
  );
  const unqueue = useCallback(
    (findingId: string, id: string) => {
      queues.current[findingId] = (queues.current[findingId] ?? []).filter(
        (entry) => entry.id !== id
      );
      syncQueue(findingId);
    },
    [syncQueue]
  );
  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

  const view = useCallback(
    (findingId: string, version: number) => {
      const state = stateFor(findingId);
      if (state) {
        setPosts((all) => ({
          ...all,
          [findingId]: { ...state, viewing: version },
        }));
      }
    },
    [stateFor]
  );

  /**
   * Writes an idea's first draft. It becomes a post with a pull request,
   * version 1, and from then on takes requests like any other.
   */
  const write = useCallback((findingId: string, direction: string | null) => {
    const draft = ITERATE_DRAFTS[findingId];
    const plan =
      plansRef.current[findingId]?.current ?? ITERATE_IDEA_PLANS[findingId];
    if (
      !(draft && plan) ||
      writesRef.current[findingId] ||
      postsRef.current[findingId]
    ) {
      return;
    }
    const entry = { startedAt: Date.now(), direction };
    writesRef.current = { ...writesRef.current, [findingId]: entry };
    setWrites((all) => ({ ...all, [findingId]: entry }));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      const first: PostVersion = {
        number: 1,
        createdAt: new Date(),
        commit: fakeCommit(`${findingId}-${Date.now()}`),
        title: draft.title,
        description: draft.description,
        blocks: draft.blocks,
        changed: [],
        before: {},
        titleBefore: null,
        request: direction,
        note: `Opened pull request #${plan.pullRequestNumber} with ${draft.blocks.filter((block) => block.startsWith("## ")).length} sections.`,
      };
      const next: PostState = { versions: [first], thread: [], viewing: 1 };
      postsRef.current = { ...postsRef.current, [findingId]: next };
      setPosts((all) => ({ ...all, [findingId]: next }));
      writesRef.current = withoutKey(writesRef.current, findingId);
      setWrites((all) => withoutKey(all, findingId));
      setWritten((all) => ({ ...all, [findingId]: plan.pullRequestNumber }));
      onFinishedRef.current?.(findingId, first);
    }, WRITE_MS);
    timers.current.add(timer);
  }, []);

  /** An idea's plan, changed or as Autopilot first wrote it. */
  const planFor = useCallback(
    (findingId: string): PlanState | null => {
      const changed = plans[findingId];
      if (changed) {
        return changed;
      }
      const plan = ITERATE_IDEA_PLANS[findingId];
      return plan
        ? { current: plan, previous: null, version: 1, note: null }
        : null;
    },
    [plans]
  );

  /** Changes an idea's plan before anything is written. */
  const revisePlan = useCallback((findingId: string, request: string) => {
    const state =
      plansRef.current[findingId] ??
      (ITERATE_IDEA_PLANS[findingId]
        ? {
            current: ITERATE_IDEA_PLANS[findingId],
            previous: null,
            version: 1,
            note: null,
          }
        : null);
    if (!state || request.trim() === "") {
      return;
    }
    setPlanning((all) => ({ ...all, [findingId]: Date.now() }));
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setPlanning((all) => withoutKey(all, findingId));
      const latest = plansRef.current[findingId] ?? state;
      const script = ITERATE_PLAN_REVISIONS[findingId] ?? [];
      const revision = script[(latest.version - 1) % script.length];
      if (!revision) {
        return;
      }
      const next: PlanState = {
        current: {
          ...latest.current,
          angle: revision.angle ?? latest.current.angle,
          outline: revision.outline,
        },
        previous: latest.current,
        version: latest.version + 1,
        note: revision.note,
      };
      plansRef.current = { ...plansRef.current, [findingId]: next };
      setPlans((all) => ({ ...all, [findingId]: next }));
    }, PLAN_MS);
    timers.current.add(timer);
  }, []);

  /** Takes the latest plan change back. */
  const undoPlan = useCallback((findingId: string) => {
    const state = plansRef.current[findingId];
    if (!state?.previous) {
      return;
    }
    const next: PlanState = {
      current: state.previous,
      previous: null,
      version: state.version + 1,
      note: null,
    };
    plansRef.current = { ...plansRef.current, [findingId]: next };
    setPlans((all) => ({ ...all, [findingId]: next }));
  }, []);

  /**
   * Takes the newest version back: its commit is reverted on the branch and
   * the one before it is current again. Returns the reverted commit.
   */
  const undo = useCallback(
    (findingId: string): { commit: string; backTo: number } | null => {
      const state = postsRef.current[findingId] ?? stateFor(findingId);
      const reverted = state?.versions.at(-1);
      if (!(state && reverted) || state.versions.length < 2) {
        return null;
      }
      const versions = state.versions.slice(0, -1);
      const backTo = versions.at(-1)?.number ?? 1;
      const next = { ...state, versions, viewing: backTo };
      postsRef.current = { ...postsRef.current, [findingId]: next };
      setPosts((all) => ({ ...all, [findingId]: next }));
      return { commit: reverted.commit, backTo };
    },
    [stateFor]
  );

  /**
   * Makes an older version current again as a new commit, so the history
   * on the pull request keeps every step.
   */
  const restore = useCallback(
    (findingId: string, number: number): PostVersion | null => {
      const state = postsRef.current[findingId] ?? stateFor(findingId);
      const old = state?.versions.find((item) => item.number === number);
      const latest = state?.versions.at(-1);
      if (!(state && old && latest) || old.number === latest.number) {
        return null;
      }
      const restored: PostVersion = {
        ...old,
        number: latest.number + 1,
        createdAt: new Date(),
        changed: [],
        before: {},
        titleBefore: null,
        request: null,
        note: `Back to version ${old.number}.`,
        commit: fakeCommit(
          `${latest.commit}-restore-${old.number}-${Date.now()}`
        ),
      };
      const next = {
        ...state,
        versions: [...state.versions, restored],
        viewing: restored.number,
      };
      postsRef.current = { ...postsRef.current, [findingId]: next };
      setPosts((all) => ({ ...all, [findingId]: next }));
      return restored;
    },
    [stateFor]
  );

  return {
    stateFor,
    ask,
    view,
    undo,
    restore,
    write,
    planFor,
    revisePlan,
    undoPlan,
    planning,
    working,
    writes,
    written,
    queued,
    unqueue,
  };
}

export type PostRevisions = ReturnType<typeof usePostRevisions>;
