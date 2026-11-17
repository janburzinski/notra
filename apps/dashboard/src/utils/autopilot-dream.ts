import { createHash } from "node:crypto";

import { AUTOPILOT_TOPIC_MAX_SIGNALS } from "@notra/ai/constants/autopilot-planner";
import type {
  AutopilotPlannerState,
  AutopilotTopic,
  AutopilotTopicSignal,
} from "@notra/ai/types/autopilot-planner";
import {
  renderPlannerState,
  topicSlug,
} from "@notra/ai/utils/autopilot-planner";
import { MEMORY_DAILY_PATH } from "@notra/memory/constants/memory";
import type { MemoryRecord } from "@notra/memory/types/records";
import { byteLength } from "@notra/memory/utils/access";
import { parseRecords, renderRecords } from "@notra/memory/utils/records";

import {
  AUTOPILOT_DREAM_ACTION_CAP_SHARE,
  AUTOPILOT_DREAM_BRIEF_MAX_LESSONS,
  AUTOPILOT_DREAM_CLOSED_TOPIC_SUMMARY_MAX_CHARS,
  AUTOPILOT_DREAM_CONVENTIONS_INTRO,
  AUTOPILOT_DREAM_CONVENTIONS_MAX_BYTES,
  AUTOPILOT_DREAM_DAILY_LINE_MAX_CHARS,
  AUTOPILOT_DREAM_DAILY_NOTE_MAX_LINES,
  AUTOPILOT_DREAM_LEARNED_PULL_REQUESTS_KEPT,
  AUTOPILOT_DREAM_LESSON_AREAS,
  AUTOPILOT_DREAM_LESSON_DENYLIST,
  AUTOPILOT_DREAM_LESSON_KEY,
  AUTOPILOT_DREAM_LESSON_KEY_MAX_CHARS,
  AUTOPILOT_DREAM_LESSON_MAX_CHARS,
  AUTOPILOT_DREAM_LESSON_MIN_PULL_REQUESTS,
  AUTOPILOT_DREAM_MAX_CANDIDATES,
  AUTOPILOT_DREAM_MAX_CONVENTIONS,
  AUTOPILOT_DREAM_MAX_MERGE_CANDIDATES,
  AUTOPILOT_DREAM_MAX_OPEN_QUESTIONS,
  AUTOPILOT_DREAM_MAX_SOURCES,
  AUTOPILOT_DREAM_MIN_ACTION_CAP,
  AUTOPILOT_DREAM_RULE_EDGE_PUNCTUATION,
  AUTOPILOT_DREAM_SIMILAR_TOPIC_SCORE,
  AUTOPILOT_DREAM_TOPIC_STOP_WORDS,
  AUTOPILOT_DREAM_TOPIC_SUMMARY_MAX_CHARS,
  AUTOPILOT_DREAM_TOPIC_TOKEN_SUFFIX,
} from "@/constants/autopilot-dream";
import type {
  AutopilotConvention,
  AutopilotDailyNoteInput,
  AutopilotDreamEntry,
  AutopilotDreamLesson,
  AutopilotDreamState,
  AutopilotLessonArea,
  AutopilotLessonCandidate,
  AutopilotLessonSource,
  AutopilotTopicMerge,
} from "@/types/autopilot-dream";

const SOURCE_PATTERN = /\[([^\],\]]+#\d+), (\d{4}-\d{2}-\d{2})\]/g;

export const EMPTY_DREAM_STATE: AutopilotDreamState = {
  version: 1,
  lastDreamAt: null,
  learnedPullRequests: [],
  candidates: [],
  checked: {},
  deferredChecks: false,
  feedbackHash: null,
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

function isArea(value: unknown): value is AutopilotLessonArea {
  return (AUTOPILOT_DREAM_LESSON_AREAS as readonly unknown[]).includes(value);
}

function parseSources(value: unknown): AutopilotLessonSource[] {
  return Array.isArray(value)
    ? value.flatMap((source) =>
        isRecord(source) &&
        typeof source.pullRequest === "string" &&
        typeof source.date === "string"
          ? [{ pullRequest: source.pullRequest, date: source.date }]
          : []
      )
    : [];
}

export function parseDreamState(json: string | null): AutopilotDreamState {
  if (!json) {
    return EMPTY_DREAM_STATE;
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return EMPTY_DREAM_STATE;
  }
  if (!isRecord(value)) {
    return EMPTY_DREAM_STATE;
  }
  const checked = isRecord(value.checked)
    ? Object.fromEntries(
        Object.entries(value.checked).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : {};
  const candidates = Array.isArray(value.candidates)
    ? value.candidates.flatMap((row): AutopilotLessonCandidate[] =>
        isRecord(row) &&
        typeof row.repository === "string" &&
        typeof row.key === "string" &&
        typeof row.lesson === "string" &&
        isArea(row.area)
          ? [
              {
                repository: row.repository,
                key: row.key,
                area: row.area,
                lesson: row.lesson,
                sources: parseSources(row.sources),
                explicit: row.explicit === true,
                firstSeenAt:
                  typeof row.firstSeenAt === "string" ? row.firstSeenAt : "",
              },
            ]
          : []
      )
    : [];
  return {
    version: 1,
    lastDreamAt:
      typeof value.lastDreamAt === "string" ? value.lastDreamAt : null,
    learnedPullRequests: strings(value.learnedPullRequests),
    candidates,
    checked,
    deferredChecks: value.deferredChecks === true,
    feedbackHash:
      typeof value.feedbackHash === "string" ? value.feedbackHash : null,
  };
}

export function renderDreamState(state: AutopilotDreamState) {
  return `${JSON.stringify(
    {
      ...state,
      learnedPullRequests: state.learnedPullRequests.slice(
        -AUTOPILOT_DREAM_LEARNED_PULL_REQUESTS_KEPT
      ),
    },
    null,
    2
  )}\n`;
}

export function hashMemoryFile(content: string | null) {
  return content === null
    ? null
    : createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function selectEntriesToCheck(params: {
  entries: readonly AutopilotDreamEntry[];
  checked: Readonly<Record<string, string>>;
  since: string | null;
  max: number;
}) {
  const { checked, since } = params;
  const changed = params.entries
    .filter((entry) => since !== null && entry.changedAt > since)
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt));
  const picked = new Set(changed.map((entry) => entry.key));
  const rest = params.entries.filter((entry) => !picked.has(entry.key));
  const never = rest
    .filter((entry) => checked[entry.key] === undefined)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  const stale = rest
    .filter((entry) => checked[entry.key] !== undefined)
    .sort((a, b) => (checked[a.key] ?? "").localeCompare(checked[b.key] ?? ""));
  return [...changed, ...never, ...stale].slice(0, params.max);
}

export function dreamActionCap(entries: number) {
  return Math.max(
    AUTOPILOT_DREAM_MIN_ACTION_CAP,
    Math.ceil(entries * AUTOPILOT_DREAM_ACTION_CAP_SHARE)
  );
}

function topicTokens(title: string) {
  return topicSlug(title)
    .split("-")
    .filter((token) => token && !AUTOPILOT_DREAM_TOPIC_STOP_WORDS.has(token))
    .map((token) =>
      token.length > 4
        ? token.replace(AUTOPILOT_DREAM_TOPIC_TOKEN_SUFFIX, "")
        : token
    );
}

function similarity(a: Set<string>, b: Set<string>) {
  const shared = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : shared / union;
}

const isClosed = (topic: AutopilotTopic) =>
  topic.status === "done" || topic.status === "dismissed";

function mergeable(topics: readonly AutopilotTopic[]) {
  const findings = new Set(topics.flatMap((topic) => topic.findingId ?? []));
  const closed = topics.filter(isClosed).length;
  return findings.size <= 1 && (closed === 0 || closed === topics.length);
}

export function findDuplicateTopics(state: AutopilotPlannerState) {
  const topics = state.topics;
  const words = topics.map((topic) => topicTokens(topic.title));
  const tokens = words.map((list) => new Set(list));
  const parent = topics.map((_, index) => index);
  const root = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      current = parent[current] ?? current;
    }
    return current;
  };
  const candidates: { a: string; b: string }[] = [];
  for (let i = 0; i < topics.length; i += 1) {
    for (let j = i + 1; j < topics.length; j += 1) {
      const a = topics[i];
      const b = topics[j];
      if (!(a && b && mergeable([a, b]))) {
        continue;
      }
      const ids = new Set(a.signals.map((signal) => signal.observationId));
      const sharesObservation = b.signals.some((signal) =>
        ids.has(signal.observationId)
      );
      const left = tokens[i] ?? new Set<string>();
      const right = tokens[j] ?? new Set<string>();
      const score = similarity(left, right);
      const sameTitle =
        left.size > 0 && words[i]?.join(" ") === words[j]?.join(" ");
      if (sharesObservation || sameTitle) {
        parent[root(j)] = root(i);
      } else if (score >= AUTOPILOT_DREAM_SIMILAR_TOPIC_SCORE) {
        candidates.push({ a: a.slug, b: b.slug });
      }
    }
  }
  const groups = new Map<number, string[]>();
  for (const [index, topic] of topics.entries()) {
    const group = groups.get(root(index)) ?? [];
    group.push(topic.slug);
    groups.set(root(index), group);
  }
  return {
    certain: [...groups.values()].filter((group) => group.length > 1),
    candidates: candidates.slice(0, AUTOPILOT_DREAM_MAX_MERGE_CANDIDATES),
  };
}

function firstSeen(topic: AutopilotTopic) {
  return topic.signals.reduce(
    (oldest, signal) => (signal.seenAt < oldest ? signal.seenAt : oldest),
    topic.updatedAt
  );
}

const STATUS_RANK: Record<AutopilotTopic["status"], number> = {
  in_progress: 5,
  ready: 4,
  researching: 3,
  watching: 2,
  done: 1,
  dismissed: 1,
};

function mergeTopicGroup(topics: readonly AutopilotTopic[]): AutopilotTopic {
  const byAge = [...topics].sort((a, b) =>
    firstSeen(a).localeCompare(firstSeen(b))
  );
  const byUpdate = [...topics].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
  const oldest = byAge[0] as AutopilotTopic;
  const latest = byUpdate[0] as AutopilotTopic;
  const acted = topics.find((topic) => topic.findingId) ?? null;
  const signals = new Map<string, AutopilotTopicSignal>();
  for (const signal of topics.flatMap((topic) => topic.signals)) {
    const known = signals.get(signal.observationId);
    if (!known || known.seenAt < signal.seenAt) {
      signals.set(signal.observationId, signal);
    }
  }
  const status = isClosed(latest)
    ? latest.status
    : [...topics].sort(
        (a, b) => STATUS_RANK[b.status] - STATUS_RANK[a.status]
      )[0]?.status;
  const described = byUpdate.find((topic) => topic.summary) ?? latest;
  return {
    ...oldest,
    status: acted && !isClosed(acted) ? acted.status : (status ?? "watching"),
    summary: described.summary,
    nextStep: described.nextStep,
    openQuestions: [
      ...new Set(byUpdate.flatMap((topic) => topic.openQuestions)),
    ].slice(0, AUTOPILOT_DREAM_MAX_OPEN_QUESTIONS),
    signals: [...signals.values()]
      .sort((a, b) => a.seenAt.localeCompare(b.seenAt))
      .slice(-AUTOPILOT_TOPIC_MAX_SIGNALS),
    findingId: acted?.findingId ?? null,
    pullRequestUrl: acted?.pullRequestUrl ?? oldest.pullRequestUrl,
    updatedAt: latest.updatedAt,
  };
}

export function mergeDuplicateTopics(
  state: AutopilotPlannerState,
  merges: readonly AutopilotTopicMerge[]
): {
  state: AutopilotPlannerState;
  merged: { kept: string; dropped: string[] }[];
} {
  const bySlug = new Map(state.topics.map((topic) => [topic.slug, topic]));
  const groups: Set<string>[] = [];
  for (const merge of merges) {
    const slugs = [merge.keep, ...merge.drop].filter((slug) =>
      bySlug.has(slug)
    );
    const joined = new Set(slugs);
    for (const group of groups.filter((row) =>
      slugs.some((slug) => row.has(slug))
    )) {
      for (const slug of group) {
        joined.add(slug);
      }
      groups.splice(groups.indexOf(group), 1);
    }
    if (joined.size > 1) {
      groups.push(joined);
    }
  }
  const replaced = new Map<string, AutopilotTopic>();
  const removed = new Set<string>();
  const merged: { kept: string; dropped: string[] }[] = [];
  for (const group of groups) {
    const topics = [...group].flatMap((slug) => bySlug.get(slug) ?? []);
    if (!mergeable(topics)) {
      continue;
    }
    const topic = mergeTopicGroup(topics);
    replaced.set(topic.slug, topic);
    const dropped = topics
      .map((row) => row.slug)
      .filter((slug) => slug !== topic.slug);
    for (const slug of dropped) {
      removed.add(slug);
    }
    merged.push({ kept: topic.slug, dropped });
  }
  return {
    state: {
      ...state,
      topics: state.topics
        .filter((topic) => !removed.has(topic.slug))
        .map((topic) => replaced.get(topic.slug) ?? topic),
    },
    merged,
  };
}

export function condensePlannerState(
  state: AutopilotPlannerState,
  maxBytes: number
) {
  const size = (value: AutopilotPlannerState) =>
    byteLength(renderPlannerState(value));
  const passes: ((topic: AutopilotTopic) => AutopilotTopic)[] = [
    (topic) =>
      isClosed(topic)
        ? {
            ...topic,
            summary: topic.summary.slice(
              0,
              AUTOPILOT_DREAM_CLOSED_TOPIC_SUMMARY_MAX_CHARS
            ),
            openQuestions: [],
            signals: topic.signals.map((signal) => ({ ...signal, detail: "" })),
          }
        : topic,
    (topic) => ({
      ...topic,
      signals: topic.signals.map((signal) => ({
        ...signal,
        detail: signal.detail.slice(0, 80),
      })),
    }),
    (topic) => ({
      ...topic,
      summary: topic.summary.slice(0, AUTOPILOT_DREAM_TOPIC_SUMMARY_MAX_CHARS),
      openQuestions: topic.openQuestions.slice(0, 2),
    }),
  ];
  let condensed = state;
  for (const pass of passes) {
    if (size(condensed) <= maxBytes) {
      break;
    }
    condensed = { ...condensed, topics: condensed.topics.map(pass) };
  }
  return condensed;
}

function normalizeRuleText(text: string) {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(AUTOPILOT_DREAM_RULE_EDGE_PUNCTUATION, "");
}

export function dedupeRules(records: readonly MemoryRecord[]) {
  const ordered = [...records].sort((a, b) =>
    String(a.meta.createdAt ?? "").localeCompare(String(b.meta.createdAt ?? ""))
  );
  const keep = new Set<MemoryRecord>();
  const texts = new Set<string>();
  const ids = new Set<string>();
  for (const record of ordered) {
    const text = normalizeRuleText(record.body || record.title);
    if ((text && texts.has(text)) || ids.has(record.id)) {
      continue;
    }
    if (text) {
      texts.add(text);
    }
    ids.add(record.id);
    keep.add(record);
  }
  const kept = records.filter((record) => keep.has(record));
  return { kept, removed: records.length - kept.length };
}

export function sanitizeLesson(text: string) {
  const lesson = text.replace(/\s+/g, " ").replaceAll("#", "").trim();
  if (
    !lesson ||
    lesson.length > AUTOPILOT_DREAM_LESSON_MAX_CHARS ||
    AUTOPILOT_DREAM_LESSON_DENYLIST.test(lesson)
  ) {
    return null;
  }
  return lesson;
}

function lessonKey(key: string, lesson: string) {
  const trimmed = key.trim().toLowerCase();
  return AUTOPILOT_DREAM_LESSON_KEY.test(trimmed) &&
    trimmed.length <= AUTOPILOT_DREAM_LESSON_KEY_MAX_CHARS
    ? trimmed
    : topicSlug(lesson).slice(0, AUTOPILOT_DREAM_LESSON_KEY_MAX_CHARS);
}

export function repositoryOfPullRequest(pullRequest: string) {
  return pullRequest.split("#")[0] ?? pullRequest;
}

function addSource(
  sources: readonly AutopilotLessonSource[],
  source: AutopilotLessonSource
) {
  return sources.some((row) => row.pullRequest === source.pullRequest)
    ? [...sources]
    : [...sources, source].slice(-AUTOPILOT_DREAM_MAX_SOURCES);
}

export function applyLessons(params: {
  candidates: readonly AutopilotLessonCandidate[];
  conventions: ReadonlyMap<string, readonly AutopilotConvention[]>;
  lessons: readonly AutopilotDreamLesson[];
  pullRequests: ReadonlyMap<string, { date: string; commented: boolean }>;
  now: Date;
}) {
  const candidates = params.candidates.map((row) => ({ ...row }));
  const conventions = new Map(
    [...params.conventions].map(([repository, rows]) => [
      repository,
      rows.map((row) => ({ ...row })),
    ])
  );
  const promoted: string[] = [];
  const reinforced: string[] = [];
  const today = params.now.toISOString().slice(0, 10);
  for (const row of params.lessons) {
    const pullRequest = params.pullRequests.get(row.pullRequest);
    const lesson = sanitizeLesson(row.lesson);
    if (!(pullRequest && lesson)) {
      continue;
    }
    const repository = repositoryOfPullRequest(row.pullRequest);
    const key = lessonKey(row.key, lesson);
    const source = { pullRequest: row.pullRequest, date: pullRequest.date };
    const known = conventions.get(repository) ?? [];
    const existing = known.find((convention) => convention.key === key);
    let candidate = candidates.find(
      (item) => item.repository === repository && item.key === key
    );
    const replacesCandidate = existing ? !row.reverses : row.reverses;
    if (candidate && replacesCandidate) {
      candidates.splice(candidates.indexOf(candidate), 1);
      candidate = undefined;
    }
    if (existing && !row.reverses) {
      existing.sources = addSource(existing.sources, source);
      reinforced.push(existing.lesson);
      continue;
    }
    if (!candidate) {
      candidate = {
        repository,
        key,
        area: row.area,
        lesson,
        sources: [],
        explicit: false,
        firstSeenAt: params.now.toISOString(),
      };
      candidates.push(candidate);
    }
    candidate.sources = addSource(candidate.sources, source);
    candidate.explicit ||= row.explicit && pullRequest.commented;
    if (
      candidate.explicit ||
      candidate.sources.length >= AUTOPILOT_DREAM_LESSON_MIN_PULL_REQUESTS
    ) {
      candidates.splice(candidates.indexOf(candidate), 1);
      conventions.set(
        repository,
        [
          ...known.filter((convention) => convention.key !== key),
          {
            key,
            area: candidate.area,
            lesson: candidate.lesson,
            learnedAt: today,
            sources: candidate.sources,
          },
        ].slice(-AUTOPILOT_DREAM_MAX_CONVENTIONS)
      );
      promoted.push(`${repository}: ${candidate.lesson}`);
    }
  }
  return {
    candidates: candidates
      .sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt))
      .slice(-AUTOPILOT_DREAM_MAX_CANDIDATES),
    conventions,
    promoted,
    reinforced,
  };
}

function conventionRecord(convention: AutopilotConvention): MemoryRecord {
  return {
    id: `convention-${convention.key}`,
    title: convention.lesson,
    body: `Learned ${convention.learnedAt} from ${convention.sources
      .map((source) => `[${source.pullRequest}, ${source.date}]`)
      .join(", ")}.`,
    meta: {
      key: convention.key,
      area: convention.area,
      learnedAt: convention.learnedAt,
    },
  };
}

/**
 * The daily brief's lines about conventions learned in this dream, from
 * `applyLessons`' "owner/repo: lesson" entries. A few by name, the rest counted.
 */
export function describeLearnedConventions(promoted: readonly string[]) {
  const named = promoted.slice(0, AUTOPILOT_DREAM_BRIEF_MAX_LESSONS);
  const rest = promoted.length - named.length;
  return [
    ...named.map((entry) => `Learned from your edits on ${entry}`),
    ...(rest > 0
      ? [
          `Learned ${rest} more ${rest === 1 ? "habit" : "habits"} from your edits`,
        ]
      : []),
  ];
}

export function parseConventions(markdown: string | null) {
  return parseRecords(markdown, "convention").flatMap(
    (record): AutopilotConvention[] => {
      const lesson = sanitizeLesson(record.title);
      if (!lesson) {
        return [];
      }
      return [
        {
          key:
            typeof record.meta.key === "string"
              ? record.meta.key
              : lessonKey("", lesson),
          area: isArea(record.meta.area) ? record.meta.area : "style",
          lesson,
          learnedAt:
            typeof record.meta.learnedAt === "string"
              ? record.meta.learnedAt
              : "",
          sources: [...record.body.matchAll(SOURCE_PATTERN)].map((match) => ({
            pullRequest: match[1] ?? "",
            date: match[2] ?? "",
          })),
        },
      ];
    }
  );
}

export function renderConventions(
  repository: string,
  conventions: readonly AutopilotConvention[]
) {
  let kept = [...conventions];
  const render = () =>
    renderRecords({
      title: `Conventions for ${repository}`,
      intro: AUTOPILOT_DREAM_CONVENTIONS_INTRO,
      records: kept.map(conventionRecord),
    });
  while (
    kept.length > 1 &&
    byteLength(render()) > AUTOPILOT_DREAM_CONVENTIONS_MAX_BYTES
  ) {
    kept = kept.slice(1);
  }
  return render();
}

function clip(line: string) {
  return line.length > AUTOPILOT_DREAM_DAILY_LINE_MAX_CHARS
    ? `${line.slice(0, AUTOPILOT_DREAM_DAILY_LINE_MAX_CHARS - 1).trimEnd()}…`
    : line;
}

function listLine(label: string, items: readonly string[]) {
  return items.length ? `- ${label}: ${items.join("; ")}` : null;
}

export function buildDailyNote(input: AutopilotDailyNoteInput) {
  const { report } = input;
  const lines = [
    listLine("Merged", input.merged),
    listLine("Closed without merging", input.closed),
    listLine("Opened for review", input.opened),
    listLine("Saved as ideas", input.ideas),
    input.answers > 0 ? `- Scans checked ${input.answers} AI answers` : null,
    report.reviewed.length
      ? `- Read ${report.reviewed.length} closed pull requests for lessons`
      : null,
    ...report.learned.map((item) => `- Learned: ${item}`),
    ...report.tidied.map((item) => `- Tidied: ${item}`),
    ...report.verified.map((item) => `- Checked: ${item}`),
  ].filter((line): line is string => line !== null);
  const header = [
    `# ${input.date}`,
    input.since
      ? `What Autopilot did and saw since ${input.since.slice(0, 16).replace("T", " ")} UTC.`
      : "What Autopilot did and saw.",
  ];
  return renderDailyNote(header, lines, 0);
}

const DAILY_NOTHING_NEW = "- Nothing new.";
const DAILY_MORE_LINE = /^- And (\d+) more$/;

function renderDailyNote(
  header: readonly string[],
  lines: readonly string[],
  hidden: number
) {
  const room = AUTOPILOT_DREAM_DAILY_NOTE_MAX_LINES - header.length;
  const body = lines.length ? [...lines] : [DAILY_NOTHING_NEW];
  if (body.length <= room && hidden === 0) {
    return `${[...header, ...body].map(clip).join("\n")}\n`;
  }
  const kept = body.slice(0, room - 1);
  const shown = [...kept, `- And ${body.length - kept.length + hidden} more`];
  return `${[...header, ...shown].map(clip).join("\n")}\n`;
}

function splitDailyNote(note: string) {
  const all = note.trimEnd().split("\n");
  const header = all.slice(0, 2);
  let hidden = 0;
  const lines = all.slice(2).filter((line) => {
    const more = DAILY_MORE_LINE.exec(line);
    if (more) {
      hidden += Number(more[1]);
      return false;
    }
    return line !== DAILY_NOTHING_NEW && line.trim() !== "";
  });
  return { header, lines, hidden };
}

export function mergeDailyNotes(existing: string | null, next: string) {
  if (!existing?.trim()) {
    return next;
  }
  const earlier = splitDailyNote(existing);
  const later = splitDailyNote(next);
  return renderDailyNote(
    earlier.header,
    [...new Set([...earlier.lines, ...later.lines])],
    earlier.hidden + later.hidden
  );
}

export function dailyNotesToPrune(paths: readonly string[], keep: number) {
  return paths
    .filter((path) => MEMORY_DAILY_PATH.test(path))
    .sort()
    .reverse()
    .slice(keep);
}

export function newestDailyNotes(paths: readonly string[], count: number) {
  return paths
    .filter((path) => MEMORY_DAILY_PATH.test(path))
    .sort()
    .reverse()
    .slice(0, count);
}
