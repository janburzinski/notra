"use client";

import {
  Download04Icon,
  GitPullRequestIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { CtaButton } from "@notra/ui/components/shared/cta-button";
import { Skeleton } from "@notra/ui/components/ui/skeleton";
import { cn } from "@notra/ui/lib/utils";
import { Player } from "@remotion/player";
import Image from "next/image";
import { useQueryState } from "nuqs";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { toast } from "sonner";

import {
  DEFAULT_PR_MERGE_PERIOD_DAYS,
  DEFAULT_SELECTED_PEOPLE,
  MAX_SELECTED_PEOPLE,
  PR_MERGE_PERIODS,
} from "@/constants/pr-merge-video";
import {
  getGithubLogin,
  getServerGithubLogin,
  subscribeToGithubConnection,
} from "@/lib/star-video/github-connection";
import { parseRepoInput } from "@/lib/star-video/parse-repo";
import {
  PR_MERGE_VIDEO_DURATION_IN_FRAMES,
  PR_MERGE_VIDEO_FPS,
  PR_MERGE_VIDEO_HEIGHT,
  PR_MERGE_VIDEO_WIDTH,
} from "@/remotion/pr-merge-video/constants";
import { PrMergeVideo } from "@/remotion/pr-merge-video/pr-merge-video";
import type {
  PrMergePeriodDays,
  PrMergeVideoInputProps,
  RepoPrMergeData,
} from "@/types/pr-merge-video";

const AVATAR_SIZE_PX = 80;

export function PrMergeVideoPreview() {
  const [repoParam] = useQueryState("repo");
  const [days, setDays] = useState<PrMergePeriodDays>(
    DEFAULT_PR_MERGE_PERIOD_DAYS
  );
  const [data, setData] = useState<RepoPrMergeData | null>(null);
  const [selectedLogins, setSelectedLogins] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const githubLogin = useSyncExternalStore(
    subscribeToGithubConnection,
    getGithubLogin,
    getServerGithubLogin
  );
  const githubConnected = githubLogin !== null;
  const containerRef = useRef<HTMLDivElement>(null);
  const previousRepo = useRef<string | null>(null);

  useEffect(() => {
    const parsed = repoParam ? parseRepoInput(repoParam) : null;

    if (repoParam && previousRepo.current !== repoParam) {
      containerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
    previousRepo.current = repoParam;

    if (!(githubConnected && parsed)) {
      setData(null);
      setSelectedLogins([]);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setData(null);
    setSelectedLogins([]);
    setIsLoading(true);

    (async () => {
      try {
        const response = await fetch(
          `/api/star-video/pr-merges/repo?owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}&days=${days}`,
          { signal: controller.signal }
        );
        if (response.ok) {
          const json: RepoPrMergeData = await response.json();
          setData(json);
          setSelectedLogins(
            json.people
              .slice(0, DEFAULT_SELECTED_PEOPLE)
              .map((person) => person.login)
          );
        } else {
          const json: { error?: string } = await response
            .json()
            .catch(() => ({}));
          toast.error(json.error ?? "Could not load that repository.");
        }
      } catch {
        if (!controller.signal.aborted) {
          toast.error("Something went wrong loading that repository.");
        }
      }
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    })();

    return () => controller.abort();
  }, [repoParam, githubConnected, days]);

  const inputProps = useMemo<PrMergeVideoInputProps | null>(() => {
    if (!data) {
      return null;
    }
    const selected = new Set(selectedLogins);
    const people = data.people.filter((person) => selected.has(person.login));
    if (people.length === 0) {
      return null;
    }
    return {
      owner: data.owner,
      repo: data.repo,
      days,
      people,
    };
  }, [data, days, selectedLogins]);

  const togglePerson = (login: string) => {
    if (selectedLogins.includes(login)) {
      setSelectedLogins(
        selectedLogins.filter((selectedLogin) => selectedLogin !== login)
      );
      return;
    }
    if (selectedLogins.length >= MAX_SELECTED_PEOPLE) {
      toast.error(`Choose up to ${MAX_SELECTED_PEOPLE} people.`);
      return;
    }
    setSelectedLogins([...selectedLogins, login]);
  };

  const onDownload = async () => {
    if (!inputProps) {
      return;
    }
    setIsRendering(true);
    const pending = toast.loading(
      "Rendering your video. This can take a minute."
    );
    try {
      const response = await fetch("/api/star-video/pr-merges/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputProps),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${inputProps.owner}-${inputProps.repo}-pr-merges.mp4`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Video ready.", { id: pending });
      } else {
        const json: { error?: string } = await response
          .json()
          .catch(() => ({}));
        toast.error(json.error ?? "Could not render the video.", {
          id: pending,
        });
      }
    } catch {
      toast.error("Something went wrong rendering the video.", { id: pending });
    }
    setIsRendering(false);
  };

  return (
    <div
      className="flex w-full max-w-4xl scroll-mt-24 flex-col items-center gap-7 px-4 sm:px-6"
      ref={containerRef}
    >
      <div className="flex w-full flex-col items-center justify-between gap-3 sm:flex-row">
        <span className="font-sans text-sm text-[#1E1E1E99] dark:text-white/50">
          Time range
        </span>
        <div
          aria-label="Time range"
          className="flex rounded-full bg-[#1E1E1E0A] p-1 dark:bg-white/[0.06]"
          role="group"
        >
          {PR_MERGE_PERIODS.map((period) => (
            <button
              aria-pressed={days === period}
              className={cn(
                "cursor-pointer rounded-full px-4 py-2 font-sans text-sm font-medium transition-colors",
                days === period
                  ? "bg-white text-[#1E1E1E] [box-shadow:0_1px_3px_#1E1E1E14] dark:bg-white/15 dark:text-white"
                  : "text-[#1E1E1E99] hover:text-[#1E1E1E] dark:text-white/55 dark:hover:text-white"
              )}
              key={period}
              onClick={() => setDays(period)}
              type="button"
            >
              {period} days
            </button>
          ))}
        </div>
      </div>

      <div className="w-full rounded-3xl border border-[#1E1E1E14] bg-[linear-gradient(in_oklab_180deg,oklab(95.1%_0.011_-0.018_/_15%)_0%,oklab(93.7%_0.019_-0.031_/_75%)_100%)] p-2 sm:p-4 dark:border-white/10 dark:bg-white/[0.02] dark:bg-none">
        <div className="bg-background overflow-hidden rounded-2xl border border-[#1E1E1E0D] dark:border-white/5">
          {isLoading ? (
            <Skeleton className="aspect-square w-full rounded-none" />
          ) : null}

          {!isLoading && inputProps ? (
            <Player
              acknowledgeRemotionLicense
              autoPlay
              className="aspect-square !h-auto !w-full"
              component={PrMergeVideo}
              compositionHeight={PR_MERGE_VIDEO_HEIGHT}
              compositionWidth={PR_MERGE_VIDEO_WIDTH}
              controls
              durationInFrames={PR_MERGE_VIDEO_DURATION_IN_FRAMES}
              fps={PR_MERGE_VIDEO_FPS}
              initiallyMuted
              inputProps={inputProps}
              key={`${data?.id}-${days}-${selectedLogins.join("-")}`}
              loop
            />
          ) : null}

          {!(isLoading || inputProps) ? (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 px-6 text-center">
              <HugeiconsIcon
                className="size-7 text-[#1E1E1E4D] dark:text-white/30"
                icon={GitPullRequestIcon}
              />
              <p className="max-w-sm font-sans text-sm text-[#1E1E1E99] dark:text-white/50">
                {data
                  ? "No people with merged pull requests were found for this time range."
                  : "Enter a repository above to build its PR merge video."}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      {data?.people.length ? (
        <div className="flex w-full flex-col gap-3">
          <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-lg font-medium tracking-[-0.02em] text-[#1E1E1E] dark:text-white">
                Choose people
              </h2>
              <p className="font-sans text-sm text-[#1E1E1E99] dark:text-white/50">
                Bots are excluded. Select up to {MAX_SELECTED_PEOPLE} people.
              </p>
            </div>
            <span className="font-sans text-xs text-[#1E1E1E80] dark:text-white/45">
              {selectedLogins.length}/{MAX_SELECTED_PEOPLE} selected
            </span>
          </div>
          <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {data.people.map((person) => {
              const selected = selectedLogins.includes(person.login);
              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                    selected
                      ? "border-primary/35 bg-primary/[0.06] dark:bg-primary/10"
                      : "border-[#1E1E1E12] bg-white hover:bg-[#1E1E1E05] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]"
                  )}
                  key={person.login}
                  onClick={() => togglePerson(person.login)}
                  type="button"
                >
                  <Image
                    alt=""
                    className="size-10 rounded-full object-cover"
                    height={AVATAR_SIZE_PX}
                    src={person.avatarUrl}
                    width={AVATAR_SIZE_PX}
                  />
                  <span className="min-w-0 grow">
                    <span className="block truncate font-sans text-sm font-semibold text-[#1E1E1E] dark:text-white">
                      {person.name || person.login}
                    </span>
                    <span className="block truncate font-sans text-xs text-[#1E1E1E80] dark:text-white/45">
                      @{person.login} · {person.merges.toLocaleString()}{" "}
                      {person.merges === 1 ? "merge" : "merges"}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-[#1E1E1E24] dark:border-white/20"
                    )}
                  >
                    {selected ? (
                      <HugeiconsIcon className="size-3" icon={Tick02Icon} />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
          {data.truncated ? (
            <p className="font-sans text-xs text-[#1E1E1E80] dark:text-white/45">
              This repository exceeded GitHub&apos;s 1,000-result search limit;
              the ranking uses the available results.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex w-full flex-col items-center gap-2 sm:items-end">
        <CtaButton
          className="font-display h-12 rounded-2xl px-6 text-[1.0625rem] font-medium tracking-[-0.015em]"
          disabled={!inputProps || isRendering}
          onClick={onDownload}
          variant="light"
        >
          <HugeiconsIcon className="size-4" icon={Download04Icon} />
          {isRendering ? "Rendering" : "Download MP4"}
        </CtaButton>
        {inputProps ? (
          <p className="font-sans text-xs text-[#1E1E1E99] dark:text-white/50">
            {inputProps.people.reduce(
              (total, person) => total + person.merges,
              0
            )}{" "}
            merges · {inputProps.owner}/{inputProps.repo}
          </p>
        ) : null}
      </div>
    </div>
  );
}
