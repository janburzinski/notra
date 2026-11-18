"use client";

import { AUTOPILOT_AUTOMATION_KINDS } from "@notra/db/constants/autopilot";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";
import { toast } from "sonner";

import {
  AUTOPILOT_ONBOARDING_ANSWER_MAX,
  AUTOPILOT_ONBOARDING_APPROVAL_OPTIONS,
  AUTOPILOT_ONBOARDING_FALLBACK_INTRO,
  AUTOPILOT_ONBOARDING_GOAL_IDS,
  AUTOPILOT_ONBOARDING_MAX_NOTES,
  AUTOPILOT_ONBOARDING_MAX_RULES,
  AUTOPILOT_ONBOARDING_QUESTIONS,
  AUTOPILOT_ONBOARDING_REFRESH_WAIT_MS,
  AUTOPILOT_ONBOARDING_SLACK_OPTIONS,
  AUTOPILOT_ONBOARDING_STEP_MIN_MS,
  AUTOPILOT_ONBOARDING_STORAGE_KEY,
  AUTOPILOT_ONBOARDING_STORAGE_VERSION,
} from "@/constants/autopilot-onboarding";
import {
  AUTOPILOT_DEFAULT_APPROVALS,
  AUTOPILOT_SETUP_APPROVALS,
} from "@/constants/autopilot-publish";
import { AUTOPILOT_AUTOMATIONS } from "@/constants/autopilot-ui";
import { useAutopilotConnections } from "@/lib/hooks/use-autopilot-connections";
import {
  patchOnboardingSession,
  readOnboardingSession,
  resetOnboardingSession,
  useAutopilotOnboardingSession,
} from "@/lib/hooks/use-autopilot-onboarding-session";
import { dashboardOrpc } from "@/lib/orpc/query";
import { storedOnboardingSchema } from "@/schemas/autopilot-onboarding";
import type { AgentQuestionAnswer } from "@/types/agent-questions";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type {
  AutopilotOnboardingAnswers,
  AutopilotOnboardingGoalId,
  AutopilotOnboardingPhase,
  AutopilotOnboardingProps,
  AutopilotOnboardingQuestionId,
  AutopilotOnboardingTurn as OnboardingTurn,
  AutopilotSetupTask,
} from "@/types/autopilot-onboarding";
import {
  autopilotOnboardingScript,
  channelLabel,
  jobsForGoals,
  matchChannel,
  matchRepository,
  onboardingDoneLine,
  readGoalAnswer,
  readRival,
} from "@/utils/autopilot-onboarding";
import { toErrorMessage } from "@/utils/error-message";

const sleep = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

/** One of each, ignoring case and end punctuation: models restate rules. */
function unique(values: string[], max: number) {
  const seen = new Map<string, string>();
  for (const value of values) {
    const text = value.trim();
    const key = text.toLowerCase().replace(/[\s.;,!]+$/, "");
    if (key && !seen.has(key)) {
      seen.set(key, text);
    }
  }
  return [...seen.values()].slice(0, max);
}

/** Every Ollie line and every answer, as the model reads the conversation. */
function transcriptOf(
  messages: ReturnType<typeof autopilotOnboardingScript>["messages"]
) {
  return messages
    .flatMap((message) =>
      message.from === "ollie"
        ? [{ from: "ollie" as const, text: message.text }]
        : [
            { from: "ollie" as const, text: message.question.question },
            {
              from: "you" as const,
              text: message.answers?.join(", ") ?? "(dismissed)",
            },
          ]
    )
    .filter((line) => line.text)
    .map((line) => ({
      ...line,
      text: line.text.slice(0, AUTOPILOT_ONBOARDING_ANSWER_MAX),
    }))
    .slice(-40);
}

/** Kept answers, if they're from this version and whole; otherwise none. */
function readStoredAnswers(organizationId: string): AutopilotOnboardingAnswers {
  try {
    const raw = window.sessionStorage.getItem(
      AUTOPILOT_ONBOARDING_STORAGE_KEY(organizationId)
    );
    const parsed = storedOnboardingSchema.safeParse(
      raw ? JSON.parse(raw) : null
    );
    return parsed.success
      ? (parsed.data.answers as AutopilotOnboardingAnswers)
      : {};
  } catch {
    return {};
  }
}

/** Session storage can be blocked or full; the chat goes on without it. */
function writeStoredAnswers(
  organizationId: string,
  answers: AutopilotOnboardingAnswers | null
) {
  try {
    const key = AUTOPILOT_ONBOARDING_STORAGE_KEY(organizationId);
    if (answers) {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          version: AUTOPILOT_ONBOARDING_STORAGE_VERSION,
          answers,
        })
      );
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Nothing to keep it in: a redirect starts the chat over.
  }
}

/** What Ollie says when he couldn't read up on the workspace. */
const FALLBACK_INTRO = {
  hello: "Hi, I'm Ollie, nice to meet you!",
  audienceOptions: [...AUTOPILOT_ONBOARDING_FALLBACK_INTRO.audienceOptions],
  voiceOptions: [...AUTOPILOT_ONBOARDING_FALLBACK_INTRO.voiceOptions],
  rivals: [],
};

/**
 * Ollie's setup chat: the answers (kept in the session, so the GitHub and
 * Slack redirects come back to the same question), what comes next, and the
 * setup that runs once everything is answered.
 */
export function useAutopilotOnboarding({
  organizationId,
  overview,
  projectId,
  basePath,
}: Pick<
  AutopilotOnboardingProps,
  "organizationId" | "overview" | "projectId" | "basePath"
>) {
  const queryClient = useQueryClient();
  const connections = useAutopilotConnections({
    organizationId,
    callbackPath: basePath,
    overview,
  });
  // The chat lives outside the page: leaving mid-answer or mid-setup and
  // coming back finds it where it was, still going.
  const session = useAutopilotOnboardingSession(organizationId);
  const { answers, thinking, pending, thought, phase, tasks } = session;
  const patch = (next: Parameters<typeof patchOnboardingSession>[1]): void =>
    patchOnboardingSession(organizationId, next);
  const setPhase = useCallback(
    (next: AutopilotOnboardingPhase) =>
      patchOnboardingSession(organizationId, { phase: next }),
    [organizationId]
  );
  /** Resolves once the dashboard behind the chat has its data. */
  const whenRefreshed = useCallback(
    () => readOnboardingSession(organizationId).refreshed,
    [organizationId]
  );

  // Session storage only exists in the browser, so it's read after mount;
  // coming back to a chat that's still going keeps it. Ollie asks everything,
  // also for a workspace whose onboarding was reset: only what can be read
  // live (the only repository, a connected Slack) is said instead.
  useEffect(() => {
    const current = readOnboardingSession(organizationId);
    const ended = current.phase === "done" || current.phase === "docking";
    if (ended && !overview.settings.enabled) {
      // Turned off or reset since: a new chat.
      resetOnboardingSession(organizationId);
    } else if (current.answers !== null) {
      return;
    }
    patch({ answers: readStoredAnswers(organizationId) });
  }, [organizationId]);

  // The ending played out: the next visit starts fresh.
  useEffect(
    () => () => {
      if (readOnboardingSession(organizationId).phase === "docking") {
        resetOnboardingSession(organizationId);
      }
    },
    [organizationId]
  );

  // Merges into the latest answers, so a reply that lands while you're on
  // another page is still kept.
  const update = (change: AutopilotOnboardingAnswers) =>
    patch(({ answers: current }) => {
      const next = {
        ...current,
        ...change,
        asked: { ...current?.asked, ...change.asked },
        replies: { ...current?.replies, ...change.replies },
        asides: { ...current?.asides, ...change.asides },
        jobs: { ...current?.jobs, ...change.jobs },
        known: { ...current?.known, ...change.known },
      };
      writeStoredAnswers(organizationId, next);
      return { answers: next };
    });

  // With a single repository there is nothing to ask: Ollie names it.
  const onlyRepository =
    connections.repositoriesLoaded && connections.repositories.length === 1
      ? connections.repositories[0]?.fullName
      : undefined;
  const needsRepository = answers !== null && !answers.repository;
  useEffect(() => {
    if (needsRepository && onlyRepository) {
      update({ repository: onlyRepository, known: { repository: true } });
    }
  }, [needsRepository, onlyRepository]);

  // A kept repository the GitHub App can no longer reach is asked again.
  const lostRepository =
    connections.repositoriesLoaded &&
    !connections.repositoriesFailed &&
    answers?.repository !== undefined &&
    !connections.repositories.some(
      (row) => row.fullName === answers.repository
    );
  useEffect(() => {
    if (lostRepository) {
      update({
        repository: undefined,
        known: { repository: undefined },
        asked: { repository: undefined },
      });
    }
  }, [lostRepository]);

  // A kept Slack channel whose workspace was disconnected is asked again.
  const lostSlack = Boolean(answers?.slack) && !connections.slackIntegration;
  useEffect(() => {
    if (lostSlack) {
      update({
        slack: undefined,
        known: { slack: undefined },
        asked: { slack: undefined },
      });
    }
  }, [lostSlack]);

  // Ollie reads up on the workspace once, before his hello.
  const needsIntro = answers !== null && !answers.intro;
  useEffect(() => {
    if (!needsIntro || readOnboardingSession(organizationId).readingUp) {
      return;
    }
    patch({ readingUp: true });
    dashboardOrpc.autopilot.onboardingIntro
      .call({
        organizationId,
        projectId: overview.settings.projectId ?? projectId ?? undefined,
      })
      .then((intro) => {
        patch((current) => ({
          thought: new Set([...current.thought, "hello"]),
        }));
        update({ intro });
      })
      // Without reading up he still says hello and asks with plain choices.
      .catch(() => update({ intro: FALLBACK_INTRO }));
  }, [needsIntro]);

  const context = {
    githubConnected: connections.githubConnected,
    repositories: connections.repositoriesLoaded
      ? connections.repositories
      : null,
    repositoriesFailed: connections.repositoriesFailed,
    slackConnected: Boolean(connections.slackIntegration),
    channelsLoaded: connections.channelsLoaded,
    channels: connections.channels,
    defaultChannelId:
      overview.settings.slackChannelId ??
      connections.slackIntegration?.notificationChannelId ??
      null,
  };
  const script = autopilotOnboardingScript(answers ?? {}, context);
  const step = thinking ? { kind: "waiting" as const } : script.step;

  /** What the setup would save now: goals first, then what the chat changed. */
  const currentJobs = (
    goals?: readonly AutopilotOnboardingGoalId[],
    defaults: Partial<Record<AutopilotAutomationKind, boolean>> = {}
  ) => {
    const picked = goals ?? answers?.goal?.goals ?? [];
    return {
      ...overview.settings.jobs,
      ...(picked.length > 0 ? jobsForGoals(picked) : {}),
      ...defaults,
      // What the team asked for in its own words always wins.
      ...answers?.jobs,
    };
  };

  /** Ollie reads an answer in the team's own words. Null if he couldn't. */
  const askOllie = async (
    id: AutopilotOnboardingQuestionId,
    text: string
  ): Promise<OnboardingTurn | null> => {
    // One answer at a time: a double submit doesn't ask the model twice.
    if (readOnboardingSession(organizationId).asking) {
      return null;
    }
    const answer = text.slice(0, AUTOPILOT_ONBOARDING_ANSWER_MAX);
    patch({
      asking: true,
      thinking: true,
      pending:
        script.step.kind === "question"
          ? { id, question: script.step.question, text: answer }
          : null,
    });
    let turn: OnboardingTurn | null = null;
    try {
      turn = await dashboardOrpc.autopilot.onboardingTurn.call({
        organizationId,
        question: id,
        questionText: AUTOPILOT_ONBOARDING_QUESTIONS[id],
        answer,
        transcript: transcriptOf(script.messages),
        draft: {
          goals: answers?.goal?.goals ?? [],
          automations: currentJobs(),
          approvals: answers?.approvals ?? AUTOPILOT_SETUP_APPROVALS,
          slackChannels: connections.channels
            .map((channel) => channel.name)
            .slice(0, 50),
        },
      });
      const asides = answers?.asides?.[id]?.length ?? 0;
      patch((current) => ({
        thought: new Set([
          ...current.thought,
          `${id}-reply`,
          `${id}-aside-${asides}-reply`,
        ]),
      }));
    } catch (error) {
      toast.error(toErrorMessage(error, "Ollie couldn't read that"));
    }
    patch({ asking: false, thinking: false, pending: null });
    return turn;
  };

  /** Approvals an answer decided, over what's set; nothing if it decided none. */
  const approvalsFrom = (turn: OnboardingTurn): AutopilotOnboardingAnswers => {
    const decided = Object.values(turn.approvals).some(Boolean);
    if (!decided) {
      return {};
    }
    const base = answers?.approvals ?? AUTOPILOT_SETUP_APPROVALS;
    return {
      approvals: {
        posts: turn.approvals.posts ?? base.posts,
        updates: turn.approvals.updates ?? base.updates,
        fixes: turn.approvals.fixes ?? base.fixes,
      },
    };
  };

  /** What any answer can teach: approvals, automations, rules and notes. */
  const learned = (
    id: AutopilotOnboardingQuestionId,
    turn: OnboardingTurn
  ): AutopilotOnboardingAnswers => ({
    replies: { [id]: turn.reply },
    ...approvalsFrom(turn),
    jobs: Object.fromEntries(
      turn.automations.map((change) => [change.kind, change.on])
    ),
    rules: unique(
      [...(answers?.rules ?? []), ...turn.rules],
      AUTOPILOT_ONBOARDING_MAX_RULES
    ),
    notes: unique(
      [...(answers?.notes ?? []), ...(turn.note ? [turn.note] : [])],
      AUTOPILOT_ONBOARDING_MAX_NOTES
    ),
  });

  /** An answer Ollie couldn't use: shown with his reply, the question comes again. */
  const setAside = (
    id: AutopilotOnboardingQuestionId,
    text: string,
    turn: OnboardingTurn
  ) =>
    update({
      asides: {
        [id]: [
          ...(answers?.asides?.[id] ?? []),
          { answer: text, reply: turn.reply },
        ],
      },
    });

  const answerGoal = async (answer: AgentQuestionAnswer) => {
    const { goals, own } = readGoalAnswer(answer);
    const text = answer.join(", ");
    const asked = { goal: [...answer] };
    if (!own) {
      update({ goal: { goals, text }, asked });
      return;
    }
    const turn = await askOllie("goal", text);
    if (!turn) {
      return;
    }
    const all = [...new Set([...goals, ...turn.goals])];
    if (!turn.understood && goals.length === 0) {
      setAside("goal", text, turn);
      return;
    }
    update({
      ...learned("goal", turn),
      goal: {
        goals: all.length > 0 ? all : [...AUTOPILOT_ONBOARDING_GOAL_IDS],
        text,
      },
      asked,
    });
  };

  const answerApprovals = async (answer: AgentQuestionAnswer) => {
    const [value = ""] = answer;
    const asked = { approvals: [...answer] };
    if (value === AUTOPILOT_ONBOARDING_APPROVAL_OPTIONS.auto.label) {
      update({ approvals: AUTOPILOT_SETUP_APPROVALS, asked });
      return;
    }
    if (value === AUTOPILOT_ONBOARDING_APPROVAL_OPTIONS.ask.label) {
      update({ approvals: AUTOPILOT_DEFAULT_APPROVALS, asked });
      return;
    }
    const turn = await askOllie("approvals", value);
    if (!turn) {
      return;
    }
    const taught = learned("approvals", turn);
    if (!(turn.understood && taught.approvals)) {
      setAside("approvals", value, turn);
      return;
    }
    update({ ...taught, asked });
  };

  const answerSlack = async (answer: AgentQuestionAnswer) => {
    const [value = ""] = answer;
    if (
      value === AUTOPILOT_ONBOARDING_SLACK_OPTIONS.connect.label ||
      value === AUTOPILOT_ONBOARDING_SLACK_OPTIONS.reconnect.label
    ) {
      window.location.assign(connections.slackAuthorizeUrl);
      return;
    }
    if (value === AUTOPILOT_ONBOARDING_SLACK_OPTIONS.email.label) {
      update({ slack: null, asked: { slack: [value] } });
      return;
    }
    const picked =
      connections.channels.find(
        (option) => channelLabel(option.name) === value
      ) ?? matchChannel(connections.channels, value);
    if (picked) {
      update({
        slack: { id: picked.id, name: picked.name },
        asked: { slack: [channelLabel(picked.name)] },
      });
      return;
    }
    const turn = await askOllie("slack", value);
    if (!turn) {
      return;
    }
    const channel = turn.slackChannel
      ? matchChannel(connections.channels, turn.slackChannel)
      : null;
    if (!(turn.understood && (channel || turn.skipSlack))) {
      setAside("slack", value, turn);
      return;
    }
    update({
      ...learned("slack", turn),
      slack: channel ? { id: channel.id, name: channel.name } : null,
      asked: { slack: [value] },
    });
  };

  const answer = (
    id: AutopilotOnboardingQuestionId,
    values: AgentQuestionAnswer
  ) => {
    if (id === "goal") {
      void answerGoal(values);
    } else if (id === "repository") {
      const repository = matchRepository(
        connections.repositories,
        values[0] ?? ""
      );
      if (repository) {
        update({
          repository: repository.fullName,
          asked: { repository: [repository.fullName] },
        });
      } else {
        toast.error(`I can't find ${values[0] ?? "that repository"}`);
      }
    } else if (id === "approvals") {
      void answerApprovals(values);
    } else {
      void answerSlack(values);
    }
  };

  /** One answer per question of the "about you" card; nothing said is null. */
  const answerAbout = (values: AgentQuestionAnswer[], ids: string[]) => {
    const said = (id: string) => {
      const answer = values[ids.indexOf(id)] ?? [];
      return answer.length > 0 ? answer.join(", ").slice(0, 120) : null;
    };
    update({
      about: {
        audience: said("audience"),
        voice: said("voice"),
        // "None" or "no comparison pages" names nobody to beat.
        rival: ids.includes("rival")
          ? readRival(said("rival"), answers?.intro?.rivals ?? [])
          : null,
      },
      asked: Object.fromEntries(
        ids.map((id, index) => [
          id,
          values[index]?.length ? [...(values[index] ?? [])] : null,
        ])
      ),
    });
  };

  const skipAbout = (ids: string[]) =>
    update({
      about: { audience: null, voice: null, rival: null },
      asked: Object.fromEntries(ids.map((id) => [id, null])),
    });

  /** Dismissing takes the default: every goal, publishing on its own, no Slack. */
  const skip = (id: AutopilotOnboardingQuestionId) => {
    const asked = { [id]: null };
    if (id === "goal") {
      update({
        goal: { goals: ["ai", "google", "releases"], text: "All of it" },
        asked,
      });
    } else if (id === "approvals") {
      update({ approvals: AUTOPILOT_SETUP_APPROVALS, asked });
    } else if (id === "slack") {
      update({ slack: null, asked });
    }
  };

  const setTask = (
    id: AutopilotSetupTask["id"],
    change: Partial<AutopilotSetupTask>
  ) =>
    patch((current) => ({
      tasks: current.tasks.map((task) =>
        task.id === id ? { ...task, ...change } : task
      ),
    }));

  const runTask = async (
    id: AutopilotSetupTask["id"],
    work: () => Promise<Partial<AutopilotSetupTask> | undefined>
  ) => {
    setTask(id, { status: "running" });
    const [result] = await Promise.all([
      work(),
      sleep(AUTOPILOT_ONBOARDING_STEP_MIN_MS),
    ]);
    setTask(id, { status: "done", ...result });
  };

  const checkData = async (goals: readonly string[]) => {
    const details: string[] = [];
    const scopeProjectId = overview.settings.projectId ?? projectId;
    if (!scopeProjectId) {
      details.push(
        "You don't track AI answers yet, so I'll start with releases and site fixes."
      );
    }
    if (goals.includes("google") || goals.includes("ai")) {
      const status = await queryClient
        .fetchQuery(
          dashboardOrpc.geo.searchConsoleStatus.queryOptions({
            input: { organizationId, projectId: scopeProjectId ?? undefined },
          })
        )
        .catch(() => null);
      if (status && !status.connected) {
        details.push(
          "Connect Search Console on the Prompts page so I can see your Google rankings."
        );
      }
    }
    return details.length > 0
      ? { status: "warning" as const, details }
      : { details: ["Reading your tracked prompts and Search Console"] };
  };

  const setUp = async () => {
    const goal = answers?.goal;
    const repository = connections.repositories.find(
      (row) => row.fullName === answers?.repository
    );
    if (!(goal && repository)) {
      // Nothing to set up yet; the chat asks for what's missing.
      patch({ settingUp: false });
      return;
    }
    // The same repository keeps the branch it was set to, and the Notra Site
    // it publishes through. Another repository drops both: a kept site would
    // send runs to the site's repository instead.
    const saved = overview.settings.repository;
    const sameRepository =
      saved?.owner === repository.owner && saved.name === repository.name;
    const keptBranch = sameRepository ? saved.branch : null;
    const about = answers?.about;
    // A rival to beat is what comparison pages are for, unless the team
    // said no to them.
    const jobs = currentJobs(
      goal.goals,
      about?.rival ? { comparisons: true } : {}
    );
    const automations = AUTOPILOT_AUTOMATION_KINDS.filter(
      (kind) => jobs[kind]
    ).length;
    // Every rule the team stated is kept; audience and voice come on top.
    const rules = unique(
      [
        ...(answers?.rules ?? []),
        ...(about?.audience ? [`Write for ${about.audience}`] : []),
        ...(about?.voice ? [`Write in this voice: ${about.voice}`] : []),
      ],
      AUTOPILOT_ONBOARDING_MAX_RULES + 2
    );
    const notes = unique(
      [
        ...(about?.rival
          ? [
              `Beat ${about.rival} first: favour comparison pages and questions where AI names ${about.rival}`,
            ]
          : []),
        ...(answers?.notes ?? []),
      ],
      AUTOPILOT_ONBOARDING_MAX_NOTES
    );
    patch({
      phase: "setup",
      tasks: [
        {
          id: "save",
          label: `Turning on ${automations} automations`,
          status: "pending",
          details: [],
        },
        {
          id: "data",
          label: "Checking what I can read",
          status: "pending",
          details: [],
        },
        {
          id: "run",
          label: "Starting my first run",
          status: "pending",
          details: [],
        },
      ],
    });
    let current: AutopilotSetupTask["id"] = "save";
    try {
      await runTask("save", async () => {
        await dashboardOrpc.autopilot.save.call({
          organizationId,
          enabled: true,
          projectId: overview.settings.projectId ?? projectId ?? undefined,
          repository: {
            owner: repository.owner,
            name: repository.name,
            branch: keptBranch ?? repository.defaultBranch,
          },
          contentPath: sameRepository ? overview.settings.contentPath : null,
          ...(sameRepository ? {} : { siteId: null }),
          slack:
            answers?.slack && connections.slackIntegration
              ? {
                  integrationId: connections.slackIntegration.id,
                  channelId: answers.slack.id,
                  channelName: answers.slack.name,
                }
              : null,
          briefHour: overview.settings.briefHour,
          // A first setup takes the browser's timezone; turning one back on
          // keeps the team's, wherever the admin is today.
          timezone: overview.settings.configured
            ? overview.settings.timezone
            : Intl.DateTimeFormat().resolvedOptions().timeZone ||
              overview.settings.timezone,
          jobs,
          approvals: answers?.approvals ?? AUTOPILOT_SETUP_APPROVALS,
          maxOpenPullRequests: overview.settings.maxOpenPullRequests,
          goal: [goal.text, ...notes].join(". ").slice(0, 1500),
          onboarded: true,
        });
        // Rules from the chat: what Autopilot always or never does. One that
        // can't be saved (the rules are full) never fails the setup.
        const saved: string[] = [];
        const skipped: string[] = [];
        for (const rule of rules) {
          try {
            await dashboardOrpc.autopilot.addRule.call({
              organizationId,
              text: rule,
            });
            saved.push(rule);
          } catch (error) {
            skipped.push(
              `Couldn't add the rule "${rule}": ${toErrorMessage(error, "try it in Settings")}`
            );
          }
        }
        return {
          label: `Turned on ${automations} automations`,
          ...(skipped.length > 0 ? { status: "warning" as const } : {}),
          details: [
            // What each one is called, as on the dashboard behind the chat.
            AUTOPILOT_AUTOMATION_KINDS.filter((kind) => jobs[kind])
              .map((kind) => AUTOPILOT_AUTOMATIONS[kind].name)
              .join(", "),
            ...saved.map((rule) => `Rule: ${rule}`),
            ...skipped,
            ...notes.map((note) => `Remembered: ${note}`),
          ],
        };
      });
      current = "data";
      await runTask("data", () => checkData(goal.goals));
      current = "run";
      await runTask("run", async () => {
        await dashboardOrpc.autopilot.runNow.call({
          organizationId,
          trigger: "onboarding",
        });
        return { label: "Started my first run" };
      });
      writeStoredAnswers(organizationId, null);
      // "All set" right away; the dashboard behind the chat loads meanwhile,
      // and the chat only fades once it has.
      const refreshed = Promise.race([
        queryClient
          .invalidateQueries({ queryKey: dashboardOrpc.autopilot.get.key() })
          .catch(() => undefined),
        sleep(AUTOPILOT_ONBOARDING_REFRESH_WAIT_MS),
      ]);
      patch({ refreshed });
      void queryClient.invalidateQueries({
        queryKey: dashboardOrpc.autopilot.key(),
      });
      setPhase("done");
    } catch (error) {
      setTask(current, {
        status: "error",
        details: [toErrorMessage(error, "Something went wrong")],
      });
    }
    patch({ settingUp: false });
  };

  const failed = tasks.some((task) => task.status === "error");
  const startSetup = () => {
    if (readOnboardingSession(organizationId).settingUp) {
      return;
    }
    patch({ settingUp: true });
    void setUp();
  };

  return {
    ready: answers !== null,
    done: {
      id: "done",
      from: "ollie" as const,
      text: onboardingDoneLine(overview.settings.briefHour),
    },
    resumed: Boolean(answers && Object.keys(answers).length > 0),
    messages: script.messages,
    pending,
    thought,
    step,
    phase,
    setPhase,
    tasks,
    answer,
    answerAbout,
    skip,
    skipAbout,
    startSetup,
    retry: failed ? startSetup : null,
    whenRefreshed,
    connectGitHub: {
      installing: connections.installing,
      onConnect: connections.installGitHub,
      onRetry: connections.repositoriesFailed
        ? connections.retryRepositories
        : null,
    },
  };
}
