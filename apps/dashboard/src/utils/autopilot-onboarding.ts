import {
  AUTOPILOT_APPROVAL_GROUPS,
  AUTOPILOT_AUTOMATION_KINDS,
} from "@notra/db/constants/autopilot";
import type { AutopilotApprovals } from "@notra/db/types/autopilot";

import {
  AUTOPILOT_ONBOARDING_ABOUT_SEPARATOR,
  AUTOPILOT_ONBOARDING_ABOUT_SKIPPED,
  AUTOPILOT_ONBOARDING_APPROVAL_OPTIONS,
  AUTOPILOT_ONBOARDING_GOAL_IDS,
  AUTOPILOT_ONBOARDING_GOALS,
  AUTOPILOT_ONBOARDING_HOW_IT_WORKS,
  AUTOPILOT_ONBOARDING_MAX_CHANNELS,
  AUTOPILOT_ONBOARDING_MAX_REPOSITORIES,
  AUTOPILOT_ONBOARDING_NO_RIVAL,
  AUTOPILOT_ONBOARDING_QUESTIONS,
  AUTOPILOT_ONBOARDING_SLACK_OPTIONS,
} from "@/constants/autopilot-onboarding";
import { AUTOPILOT_PUBLISH_HOUR } from "@/constants/autopilot-publish";
import type { AgentQuestion } from "@/types/agent-questions";
import type { AutopilotAutomationKind } from "@/types/autopilot-metrics";
import type {
  AutopilotOnboardingAbout,
  AutopilotOnboardingAnswers,
  AutopilotOnboardingChannel,
  AutopilotOnboardingContext,
  AutopilotOnboardingGoalId,
  AutopilotOnboardingIntro,
  AutopilotOnboardingMessage,
  AutopilotOnboardingQuestionId,
  AutopilotOnboardingRepository,
  AutopilotOnboardingStep,
} from "@/types/autopilot-onboarding";

const ollie = (id: string, text: string): AutopilotOnboardingMessage => ({
  id,
  from: "ollie",
  text,
});

/** An answered question, shown the way the agent chat shows one. */
function you(
  id: AutopilotOnboardingQuestionId,
  question: AgentQuestion,
  answers: AutopilotOnboardingAnswers,
  fallback: string
): AutopilotOnboardingMessage {
  const asked = answers.asked?.[id];
  return {
    id: `${id}-answer`,
    from: "you",
    question,
    answers: asked === undefined ? [fallback] : asked,
  };
}

const listFormat = new Intl.ListFormat("en", {
  style: "long",
  type: "conjunction",
});

export const channelLabel = (name: string) => `#${name.replace(/^#/, "")}`;

/** The automations the goals need; the rest start off. */
export function jobsForGoals(goals: readonly AutopilotOnboardingGoalId[]) {
  const on = new Set<AutopilotAutomationKind>(
    goals.flatMap((goal) => AUTOPILOT_ONBOARDING_GOALS[goal].kinds)
  );
  return Object.fromEntries(
    AUTOPILOT_AUTOMATION_KINDS.map((kind) => [kind, on.has(kind)])
  ) as Record<AutopilotAutomationKind, boolean>;
}

/** Picked option labels as goals; anything else is the team's own words. */
export function readGoalAnswer(answer: readonly string[]) {
  const goals: AutopilotOnboardingGoalId[] = [];
  const own: string[] = [];
  for (const value of answer) {
    const goal = AUTOPILOT_ONBOARDING_GOAL_IDS.find(
      (id) => AUTOPILOT_ONBOARDING_GOALS[id].label === value
    );
    if (goal) {
      goals.push(goal);
    } else if (value.trim()) {
      own.push(value.trim());
    }
  }
  return { goals, own: own.join("; ") || null };
}

const byPushedAt = (
  a: AutopilotOnboardingRepository,
  b: AutopilotOnboardingRepository
) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "");

/** A typed repository name: its full name, or the name alone when that's unique. */
export function matchRepository(
  repositories: readonly AutopilotOnboardingRepository[],
  typed: string
) {
  const query = typed
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/github\.com\//, "");
  if (!query) {
    return null;
  }
  const exact = repositories.find(
    (repository) => repository.fullName.toLowerCase() === query
  );
  if (exact) {
    return exact;
  }
  const named = repositories.filter((repository) => {
    const fullName = repository.fullName.toLowerCase();
    return fullName.endsWith(`/${query}`) || fullName.includes(query);
  });
  return named.length === 1 ? (named[0] ?? null) : null;
}

export function matchChannel(
  channels: readonly AutopilotOnboardingChannel[],
  typed: string
) {
  const query = typed.trim().toLowerCase().replace(/^#/, "");
  return (
    channels.find((channel) => channel.name.toLowerCase() === query) ?? null
  );
}

function question(
  id: keyof typeof AUTOPILOT_ONBOARDING_QUESTIONS,
  options: AgentQuestion["options"],
  multiple = false
): AgentQuestion {
  return {
    question: AUTOPILOT_ONBOARDING_QUESTIONS[id],
    header: id,
    options,
    multiple,
  };
}

/**
 * Connected to Slack: its channels, the default one first. Not connected:
 * connect it. Email only is always there.
 */
function slackOptions(context: AutopilotOnboardingContext) {
  if (!context.slackConnected) {
    return [
      AUTOPILOT_ONBOARDING_SLACK_OPTIONS.connect,
      AUTOPILOT_ONBOARDING_SLACK_OPTIONS.email,
    ];
  }
  if (context.channels.length === 0) {
    return [
      AUTOPILOT_ONBOARDING_SLACK_OPTIONS.reconnect,
      AUTOPILOT_ONBOARDING_SLACK_OPTIONS.email,
    ];
  }
  const channels = [...context.channels].sort(
    (a, b) =>
      Number(b.id === context.defaultChannelId) -
      Number(a.id === context.defaultChannelId)
  );
  return [
    ...channels.slice(0, AUTOPILOT_ONBOARDING_MAX_CHANNELS).map((channel) => ({
      label: channelLabel(channel.name),
      description:
        channel.id === context.defaultChannelId
          ? "Your Slack notification channel"
          : undefined,
    })),
    AUTOPILOT_ONBOARDING_SLACK_OPTIONS.email,
  ];
}

function repositoryStep(
  context: AutopilotOnboardingContext,
  messages: AutopilotOnboardingMessage[]
): AutopilotOnboardingStep {
  if (!context.githubConnected) {
    messages.push(
      ollie(
        "github",
        "I work through pull requests on your website's repository. Connect GitHub and I'll pick up right here."
      )
    );
    return { kind: "connect-github" };
  }
  if (context.repositories === null) {
    return { kind: "waiting" };
  }
  if (context.repositoriesFailed) {
    messages.push(
      ollie(
        "github-failed",
        "I couldn't load your repositories just now. Try again, or check that the Notra app can reach your website's repository."
      )
    );
    return { kind: "connect-github" };
  }
  if (context.repositories.length === 0) {
    messages.push(
      ollie(
        "github-empty",
        "I can't see any repositories yet. Give the Notra app access to your website's repository."
      )
    );
    return { kind: "connect-github" };
  }
  return {
    kind: "question",
    id: "repository",
    skippable: false,
    question: question(
      "repository",
      [...context.repositories]
        .sort(byPushedAt)
        .slice(0, AUTOPILOT_ONBOARDING_MAX_REPOSITORIES)
        .map((repository) => ({ label: repository.fullName }))
    ),
  };
}

/** How the approvals read back: the stock answer, or each kind spelled out. */
function approvalsSummary(approvals: AutopilotApprovals) {
  const modes = new Set(Object.values(approvals));
  if (modes.size === 1) {
    return modes.has("ask")
      ? {
          label: AUTOPILOT_ONBOARDING_APPROVAL_OPTIONS.ask.label,
          reply: "Deal. Every draft waits for your merge.",
          known: "Like before, every draft waits for your merge.",
        }
      : {
          label: AUTOPILOT_ONBOARDING_APPROVAL_OPTIONS.auto.label,
          reply: `I'll merge on weekdays at ${AUTOPILOT_PUBLISH_HOUR}:00. The first one of each kind waits for you.`,
          known: `Like before, I'll merge on weekdays at ${AUTOPILOT_PUBLISH_HOUR}:00 once you've merged the first of each kind.`,
        };
  }
  const groups = (mode: "ask" | "auto") =>
    listFormat.format(
      AUTOPILOT_APPROVAL_GROUPS.filter((group) => approvals[group] === mode)
    );
  return {
    label: "Depends on the kind",
    reply: `I'll publish ${groups("auto")} on my own and wait for you on ${groups("ask")}.`,
    known: `Like before, I'll publish ${groups("auto")} on my own and wait for you on ${groups("ask")}.`,
  };
}

/** Who to write for, how to sound and who to beat, with choices that fit the brand. */
function aboutQuestions(intro: AutopilotOnboardingIntro) {
  const asked = (
    id: AutopilotOnboardingQuestionId,
    options: readonly string[]
  ) => ({
    id,
    question: question(
      id,
      options.map((label) => ({ label }))
    ),
  });
  return [
    asked("audience", intro.audienceOptions),
    asked("voice", intro.voiceOptions),
    ...(intro.rivals.length > 0 ? [asked("rival", intro.rivals)] : []),
  ];
}

function aboutReply(about: AutopilotOnboardingAbout) {
  const plans = [
    about.audience ? `write for ${about.audience}` : null,
    about.voice ? `keep it ${about.voice.toLowerCase()}` : null,
    about.rival ? `go after ${about.rival} first` : null,
  ].filter((plan): plan is string => plan !== null);
  return plans.length > 0
    ? `Love it. I'll ${listFormat.format(plans)}.`
    : "No problem, I'll learn how you like it as we go.";
}

/** A question Ollie asked again: the answer he couldn't use, then his reply. */
function pushAsides(
  messages: AutopilotOnboardingMessage[],
  id: AutopilotOnboardingQuestionId,
  asked: AgentQuestion,
  answers: AutopilotOnboardingAnswers
) {
  for (const [index, aside] of (answers.asides?.[id] ?? []).entries()) {
    messages.push(
      {
        id: `${id}-aside-${index}`,
        from: "you",
        question: asked,
        answers: [aside.answer],
      },
      ollie(`${id}-aside-${index}-reply`, aside.reply)
    );
  }
}

/**
 * The whole conversation as a function of the answers: what Ollie and you
 * said, and what comes next. Rebuilding it after the GitHub or Slack
 * redirect picks up exactly where it was.
 */
export function autopilotOnboardingScript(
  answers: AutopilotOnboardingAnswers,
  context: AutopilotOnboardingContext
): { messages: AutopilotOnboardingMessage[]; step: AutopilotOnboardingStep } {
  // Ollie reads up on the workspace before he says anything.
  if (!answers.intro) {
    return { messages: [], step: { kind: "waiting" } };
  }
  const messages = [
    ollie("hello", answers.intro.hello),
    ollie("how-it-works", AUTOPILOT_ONBOARDING_HOW_IT_WORKS),
  ];
  const reply = (id: AutopilotOnboardingQuestionId, stock: string) =>
    ollie(`${id}-reply`, answers.replies?.[id] ?? stock);
  const goalQuestion = question(
    "goal",
    AUTOPILOT_ONBOARDING_GOAL_IDS.map((id) => ({
      label: AUTOPILOT_ONBOARDING_GOALS[id].label,
      description: AUTOPILOT_ONBOARDING_GOALS[id].description,
    })),
    true
  );
  pushAsides(messages, "goal", goalQuestion, answers);
  if (!answers.goal) {
    return {
      messages,
      step: {
        kind: "question",
        id: "goal",
        skippable: true,
        question: goalQuestion,
      },
    };
  }
  const plans = answers.goal.goals.map(
    (goal) => AUTOPILOT_ONBOARDING_GOALS[goal].plan
  );
  messages.push(
    you("goal", goalQuestion, answers, answers.goal.text),
    reply("goal", `Got it. I'll ${listFormat.format(plans)}.`)
  );

  const about = aboutQuestions(answers.intro);
  messages.push(
    ollie("about-intro", "Now a little about you, so I sound like you.")
  );
  if (!answers.about) {
    return {
      messages,
      step: {
        kind: "about",
        ids: about.map((item) => item.id),
        questions: about.map((item) => item.question),
      },
    };
  }
  // The card was one question, so its answers are one reply: what was
  // answered, in the card's order, or that it was skipped.
  const said = about.flatMap((item) => {
    const given = answers.asked?.[item.id];
    return given?.length ? [given.join(", ")] : [];
  });
  messages.push({
    id: "about-answer",
    from: "you",
    question: { question: "", header: "about", options: [], multiple: false },
    answers: [
      said.length > 0
        ? said.join(AUTOPILOT_ONBOARDING_ABOUT_SEPARATOR)
        : AUTOPILOT_ONBOARDING_ABOUT_SKIPPED,
    ],
  });
  messages.push(ollie("about-reply", aboutReply(answers.about)));

  if (!answers.repository) {
    return { messages, step: repositoryStep(context, messages) };
  }
  messages.push(
    ...(answers.known?.repository
      ? [
          ollie(
            "repository-known",
            `I'll open pull requests on ${answers.repository}, the repository you've connected.`
          ),
        ]
      : [
          you(
            "repository",
            question("repository", []),
            answers,
            answers.repository
          ),
          reply(
            "repository",
            `Great, everything I do shows up as a pull request on ${answers.repository}.`
          ),
        ])
  );

  const approvalsQuestion = question("approvals", [
    AUTOPILOT_ONBOARDING_APPROVAL_OPTIONS.auto,
    AUTOPILOT_ONBOARDING_APPROVAL_OPTIONS.ask,
  ]);
  pushAsides(messages, "approvals", approvalsQuestion, answers);
  if (!answers.approvals) {
    return {
      messages,
      step: {
        kind: "question",
        id: "approvals",
        skippable: true,
        question: approvalsQuestion,
      },
    };
  }
  const approvals = approvalsSummary(answers.approvals);
  messages.push(
    ...(answers.known?.approvals
      ? [ollie("approvals-known", approvals.known)]
      : [
          you("approvals", approvalsQuestion, answers, approvals.label),
          reply("approvals", approvals.reply),
        ])
  );

  const slackQuestion = question("slack", slackOptions(context));
  pushAsides(messages, "slack", slackQuestion, answers);
  // Connected to Slack: wait for its channels instead of offering none.
  if (
    answers.slack === undefined &&
    context.slackConnected &&
    !context.channelsLoaded
  ) {
    return { messages, step: { kind: "waiting" } };
  }
  if (answers.slack === undefined) {
    return {
      messages,
      step: {
        kind: "question",
        id: "slack",
        skippable: true,
        question: slackQuestion,
      },
    };
  }
  const slackReply = answers.slack
    ? `I'll post a short brief in ${channelLabel(answers.slack.name)} every morning.`
    : "Got it, no Slack. I'll email you whenever a draft is ready for you.";
  messages.push(
    ...(answers.known?.slack
      ? [
          ollie(
            "slack-known",
            answers.slack
              ? `Like before, the morning brief goes to ${channelLabel(answers.slack.name)}.`
              : "Like before, I'll email you when a draft is ready."
          ),
        ]
      : [
          you(
            "slack",
            slackQuestion,
            answers,
            answers.slack
              ? channelLabel(answers.slack.name)
              : AUTOPILOT_ONBOARDING_SLACK_OPTIONS.email.label
          ),
          reply("slack", slackReply),
        ])
  );
  // Setup needs the repository confirmed against what GitHub can reach.
  if (context.repositories === null) {
    return { messages, step: { kind: "waiting" } };
  }
  // They couldn't be loaded: the GitHub step offers to try again.
  if (context.repositoriesFailed) {
    messages.push(
      ollie(
        "github-failed-setup",
        "I couldn't reach your repositories to finish setting up. Try again, or check that the Notra app can reach your website's repository."
      )
    );
    return { messages, step: { kind: "connect-github" } };
  }
  return { messages, step: { kind: "setup" } };
}

/** A whole number of milliseconds (or anything else) within the range. */
export function randomBetween(range: { min: number; max: number }) {
  return range.min + Math.round(Math.random() * (range.max - range.min));
}

/**
 * Ollie's last line: where the work shows up and when he runs again, so
 * nobody wonders what happens now.
 */
export function onboardingDoneLine(briefHour: number) {
  const when =
    briefHour < 12
      ? `every morning at ${briefHour}:00`
      : `every day at ${briefHour}:00`;
  return `All set, my first run has started! Drafts show up under Pull requests as I write them, and from now on I run ${when}. Ask me anything down here.`;
}

/**
 * The rival named in the "about you" card, or null when it names nobody. A
 * competitor Ollie offered always counts, whatever it's called.
 */
export function readRival(answer: string | null, offered: readonly string[]) {
  if (!answer) {
    return null;
  }
  if (offered.includes(answer)) {
    return answer;
  }
  return AUTOPILOT_ONBOARDING_NO_RIVAL.test(answer) ? null : answer;
}
