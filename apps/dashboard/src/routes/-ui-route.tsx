import { createRoute, type Router, useRouter } from "@tanstack/react-router";
import { createElement, Suspense, use, useMemo } from "react";
import { createTranslator } from "use-intl/core";

import { SSR_DATA_ONLY_PENDING_MS } from "@/constants/ui-route";
import { followServerRedirect } from "@/lib/framework/follow-server-redirect";
import { getCatalog } from "@/lib/i18n/catalog";
import type { DashboardLocale } from "@/types/i18n";
import type {
  UiPageWithDataProps,
  UiRouteFactoryOptions,
  UiRouteSearch,
  UiRouteTitle,
  UiPageParams,
} from "@/types/ui-route";

interface RootLoaderData {
  locale: DashboardLocale;
}

function translateTitle(title: UiRouteTitle, root: RootLoaderData | undefined) {
  const messages = root && getCatalog(root.locale);
  if (!(title.namespace && title.key && root && messages)) {
    return { title: title.title, description: undefined as string | undefined };
  }
  const t = createTranslator({
    locale: root.locale,
    messages,
    namespace: title.namespace as never,
  }) as unknown as (key: string) => string;
  return {
    title: t(title.key),
    description: title.descriptionKey ? t(title.descriptionKey) : undefined,
  };
}

export function uiRouteSearch(search: Record<string, unknown>): UiRouteSearch {
  return Object.fromEntries(
    Object.entries(search).map(([key, value]) => {
      if (Array.isArray(value)) {
        return [key, value.map(String)];
      }
      return [
        key,
        value === undefined || value === null ? undefined : String(value),
      ];
    })
  );
}

export function uiPageParams(
  params: Record<string, string | undefined>
): UiPageParams {
  return {
    slug: params.slug ?? "",
    id: params.id ?? "",
    name: params.name ?? "",
    chatId: params.chatId ?? "",
    handle: params.handle ?? "",
    competitor: params.competitor ?? "",
    integrationSlug: params.integrationSlug ?? "",
    siteId: params.siteId ?? "",
    deploymentId: params.deploymentId ?? "",
    tab: params.tab ?? "",
  };
}

/**
 * The page with its data, streamed or loaded. One component for both, so a
 * route whose data arrives either way keeps its page mounted between them.
 */
function UiPageWithData<T>({
  page: Page,
  pending,
  data,
  ...props
}: UiPageWithDataProps<T>) {
  return <Page data={pending ? use(pending) : data} {...props} />;
}

export function createUiRoute<T = undefined>({
  parent,
  path,
  component: Page,
  loader,
  pendingComponent,
  title,
  pageTitle,
  titleSuffix,
  noindex,
  stream,
  gate,
  ssrDataOnly,
  preload,
  loaderSearchKeys,
}: UiRouteFactoryOptions<T>) {
  const route = createRoute({
    getParentRoute: () => parent,
    path,
    validateSearch: uiRouteSearch,
    loaderDeps: ({ search }) => ({
      search: loaderSearchKeys
        ? Object.fromEntries(
            loaderSearchKeys.map((key) => [key, search[key]] as const)
          )
        : search,
    }),
    loader: async ({ params, location, preload: preloading }) => {
      const input = {
        params,
        searchParams: uiRouteSearch(location.search as Record<string, unknown>),
      };
      if (ssrDataOnly && !import.meta.env.SSR) {
        if (gate && !preloading) {
          followServerRedirect(
            gate(input),
            () => window.location.pathname === location.pathname
          ).catch(() => undefined);
        }
        return { data: undefined, pending: undefined };
      }
      if (
        stream &&
        loader &&
        (import.meta.env.SSR || (stream === true && gate))
      ) {
        await gate?.(input);
        const pending = loader({ ...input, gated: gate !== undefined });
        void pending.catch(() => undefined);
        return {
          data: undefined,
          pending,
        };
      }
      return { data: await loader?.(input), pending: undefined };
    },
    head: ({ loaderData, matches, params }) => {
      const routeTitle =
        typeof title === "function" ? title(uiPageParams(params)) : title;
      const metadata = routeTitle
        ? translateTitle(
            routeTitle,
            matches[0]?.loaderData as RootLoaderData | undefined
          )
        : undefined;
      const pageHeading =
        loaderData?.data !== undefined && pageTitle
          ? pageTitle(loaderData.data as T)
          : metadata?.title;
      const suffix = titleSuffix?.(matches);
      const heading =
        pageHeading && suffix ? `${pageHeading} · ${suffix}` : pageHeading;
      return {
        meta: [
          ...(heading ? [{ title: `${heading} - Notra` }] : []),
          ...(metadata?.description
            ? [
                {
                  name: "description",
                  content: metadata.description,
                },
              ]
            : []),
          ...(noindex
            ? [{ name: "robots", content: "noindex, nofollow" }]
            : []),
        ],
      };
    },
    pendingComponent,
    ...(ssrDataOnly ? { pendingMs: SSR_DATA_ONLY_PENDING_MS } : {}),
  });
  function UiPage() {
    const router = useRouter();
    const { data, pending } = route.useLoaderData<Router<typeof route>>();
    const params = route.useParams<Router<typeof route>>();
    const searchParams = route.useSearch<Router<typeof route>>();
    const streamed = useMemo(
      () =>
        pending &&
        followServerRedirect(pending as Promise<T>, () =>
          router.state.matches.some(
            (match) =>
              match.pathname === router.state.location.pathname &&
              (match.loaderData as { pending?: Promise<T> } | undefined)
                ?.pending === pending
          )
        ),
      [pending, router]
    );
    const page = (
      <UiPageWithData
        data={data as T}
        page={Page}
        params={uiPageParams(params)}
        pending={streamed}
        searchParams={searchParams}
      />
    );
    return stream || pendingComponent ? (
      <Suspense
        fallback={pendingComponent ? createElement(pendingComponent) : null}
      >
        {page}
      </Suspense>
    ) : (
      page
    );
  }
  const preloadPage =
    preload ?? (Page as { preload?: () => Promise<unknown> }).preload;
  const preloadPending = (
    pendingComponent as { preload?: () => Promise<unknown> } | undefined
  )?.preload;
  if (preloadPage || preloadPending) {
    Object.assign(UiPage, {
      preload: () => Promise.all([preloadPage?.(), preloadPending?.()]),
    });
  }
  return route.update({ component: UiPage });
}
