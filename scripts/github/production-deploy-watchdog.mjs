import { pathToFileURL } from "node:url";

// Runs shortly after each scheduled release window. A GitHub Actions outage can
// drop the scheduled run or fail it before any job starts; then the release
// workflow's own Slack alert never runs either and the window is silently lost.
const workflow = "production-deploy.yml";
// Must match the release cron in production-deploy.yml (checked by the test).
export const releaseHours = [12, 19];
export const releaseTimeZone = "Europe/Berlin";
// A scheduled run may still be queued this soon after its window opens.
const graceMinutes = 30;
const hour = 3_600_000;

/** The latest release window that opened at or before `now`. */
export function releaseWindowStart(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: releaseTimeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(now))
      .map((part) => [part.type, part.value])
  );
  const localMidnight = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day)
  );
  const offset =
    localMidnight +
    (Number(parts.hour) * 3600 +
      Number(parts.minute) * 60 +
      Number(parts.second)) *
      1000 -
    Math.floor(now / 1000) * 1000;
  const lastHour = releaseHours.at(-1) ?? 0;
  return Math.max(
    ...[
      ...releaseHours.map((releaseHour) => localMidnight + releaseHour * hour),
      localMidnight - 24 * hour + lastHour * hour,
    ]
      .map((local) => local - offset)
      .filter((start) => start <= now)
  );
}

function githubHeaders(env) {
  return {
    Authorization: `Bearer ${env.GH_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function github(env, fetchImpl, path, init = {}) {
  const response = await fetchImpl(
    `https://api.github.com/repos/${env.GITHUB_REPOSITORY}${path}`,
    {
      ...init,
      headers: { ...githubHeaders(env), ...init.headers },
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(`GitHub ${path}: HTTP ${response.status}`);
  }
  return response.status === 204 ? null : await response.json();
}

/**
 * A release counts as started once any job exists or the run is still going.
 * Gate and deploy failures are not retried: the release workflow alerts on
 * those itself, and running the same red gate again would not help.
 */
export function releaseStarted(runs) {
  return runs.some((run) => run.status !== "completed" || run.jobCount > 0);
}

export async function watchProductionDeploy({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now(),
  report = console.log,
} = {}) {
  if (!(env.GH_TOKEN && env.GITHUB_REPOSITORY)) {
    throw new Error("GH_TOKEN and GITHUB_REPOSITORY are required");
  }
  const windowStart = releaseWindowStart(now);
  if (now - windowStart < graceMinutes * 60_000) {
    await report("The release window opened moments ago; nothing to do yet");
    return { restarted: false };
  }
  // Searching from the window itself, so a late watchdog still finds its run.
  const since = new Date(windowStart).toISOString();
  const until = new Date(now).toISOString();
  // Only the scheduled run: a manual run here may be a dry run, and redeploying
  // after a real manual release is harmless because unchanged projects skip.
  const { workflow_runs: found } = await github(
    env,
    fetchImpl,
    `/actions/workflows/${workflow}/runs?event=schedule&created=${since}..${until}&per_page=20`
  );
  const runs = await Promise.all(
    found.map(async (run) => ({
      ...run,
      jobCount:
        run.status === "completed"
          ? (
              await github(
                env,
                fetchImpl,
                `/actions/runs/${run.id}/jobs?filter=latest&per_page=1`
              )
            ).total_count
          : 0,
    }))
  );
  for (const run of runs) {
    await report(
      `run ${run.id} (${run.event}): ${run.status}/${run.conclusion ?? "pending"}, ${run.jobCount} jobs`
    );
  }
  if (releaseStarted(runs)) {
    await report("A release started in this window; nothing to do");
    return { restarted: false };
  }

  await github(env, fetchImpl, `/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main" }),
    headers: { "Content-Type": "application/json" },
  });
  const reason =
    runs.length === 0
      ? "the scheduled run never started"
      : "the scheduled run failed before any job started";
  const message = `:warning: Production deploy restarted: ${reason} (likely a GitHub Actions outage)`;
  await report(message);
  if (env.SLACK_WEBHOOK_URL) {
    const runsUrl = `https://github.com/${env.GITHUB_REPOSITORY}/actions/workflows/${workflow}`;
    const response = await fetchImpl(env.SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${message}\n${runsUrl}` }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      await report(`Slack alert failed: HTTP ${response.status}`);
    }
  }
  return { restarted: true, reason };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await watchProductionDeploy();
}
