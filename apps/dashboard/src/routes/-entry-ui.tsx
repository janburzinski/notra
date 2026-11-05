import {
  type AnyRoute,
  createRoute,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { Suspense } from "react";

import { LoginFormSkeleton } from "@/components/auth/login-form-skeleton";
import { lazyPage } from "@/utils/lazy-page";

import { createDevelopmentUiRoutes } from "./-development-ui";
import { loadTrafficEmbed } from "./-embed-loaders";
import {
  loadAppEntry,
  loadAuthCallback,
  loadDemoEntry,
  loadGuestAccess,
  loadIntegrationEntry,
  loadLegacyApiKeys,
  loadLogin,
} from "./-entry-loaders";
import { loadInvitation } from "./-invitation-loaders";
import { loadSharedChat } from "./-share-loaders";
import { createUiRoute, uiRouteSearch } from "./-ui-route";

const AuthPublicLayout = lazyPage(() => import("@/app/(auth-public)/layout"));
const AuthSplitShell = lazyPage(() =>
  import("@/components/auth/auth-split-shell").then((module) => ({
    default: module.AuthSplitShell,
  }))
);
const Login = lazyPage(() => import("./-login-page"));
const DemoStart = lazyPage(() =>
  import("@/components/demo/demo-start").then((module) => ({
    default: module.DemoStart,
  }))
);
const InvitationConfirm = lazyPage(() =>
  import("@/components/invitation/invitation-confirm").then((module) => ({
    default: module.InvitationConfirm,
  }))
);
const Signup = lazyPage(() => import("@/app/(auth)/signup/page"));
const ForgotPassword = lazyPage(
  () => import("@/app/(auth)/forgot-password/page")
);
const ResetPassword = lazyPage(
  () => import("@/app/(auth-public)/reset-password/page")
);
const Banned = lazyPage(() => import("@/app/auth/banned/page"));
const Linkedin = lazyPage(() => import("@/app/connect/linkedin/page"));
const TrafficEmbed = lazyPage(() =>
  import("@/components/geo/ai-traffic-embed").then((module) => ({
    default: module.AiTrafficEmbed,
  }))
);
const SharedChat = lazyPage(() =>
  import("@/components/chat/shared-chat-page").then((module) => ({
    default: module.SharedChatPage,
  }))
);

export function createEntryUiRoutes(parent: AnyRoute) {
  function GuestLayout() {
    return (
      <AuthSplitShell>
        <Suspense fallback={<LoginFormSkeleton />}>
          <Outlet />
        </Suspense>
      </AuthSplitShell>
    );
  }
  GuestLayout.preload = AuthSplitShell.preload;

  const guest = createRoute({
    getParentRoute: () => parent,
    id: "guest",
    validateSearch: uiRouteSearch,
    beforeLoad: ({ search }) =>
      loadGuestAccess({ data: { params: {}, searchParams: search } }),
    component: GuestLayout,
  });

  return [
    ...(process.env.NODE_ENV === "development"
      ? createDevelopmentUiRoutes(parent)
      : []),
    createUiRoute({
      parent,
      path: "/",
      component: () => null,
      loader: (input) => loadAppEntry({ data: input }),
    }),
    guest.addChildren([
      createUiRoute({
        parent: guest,
        path: "login",
        pendingComponent: LoginFormSkeleton,
        loader: (input) => loadLogin({ data: input }),
        preload: Login.preload,
        component: ({ data }) => <Login data={data} />,
      }),
      createUiRoute({
        parent: guest,
        path: "signup",
        preload: Signup.preload,
        component: ({ searchParams }) => (
          <Signup
            returnTo={
              typeof searchParams.returnTo === "string"
                ? searchParams.returnTo
                : undefined
            }
          />
        ),
      }),
      createUiRoute({
        parent: guest,
        path: "forgot-password",
        preload: ForgotPassword.preload,
        component: () => <ForgotPassword />,
      }),
    ]),
    createUiRoute({
      parent,
      path: "reset-password",
      preload: () =>
        Promise.all([ResetPassword.preload(), AuthPublicLayout.preload()]),
      component: () => (
        <AuthPublicLayout>
          <Suspense fallback={<LoginFormSkeleton />}>
            <ResetPassword />
          </Suspense>
        </AuthPublicLayout>
      ),
    }),
    createUiRoute({ parent, path: "auth/banned", component: () => <Banned /> }),
    createUiRoute({
      parent,
      path: "auth/demo",
      loader: (input) => loadDemoEntry({ data: input }),
      preload: DemoStart.preload,
      component: ({ data }) => (
        <div className="flex min-h-screen items-center justify-center px-2 py-6 sm:px-6">
          <DemoStart
            returnTo={data.returnTo}
            turnstileSiteKey={data.turnstileSiteKey}
          />
        </div>
      ),
    }),
    createUiRoute({
      parent,
      path: "invitation",
      title: { title: "Invitation" },
      loader: (input) => loadInvitation({ data: input }),
      preload: () =>
        Promise.all([InvitationConfirm.preload(), AuthSplitShell.preload()]),
      component: ({ data }) => (
        <AuthSplitShell>
          <InvitationConfirm data={data} />
        </AuthSplitShell>
      ),
    }),
    createUiRoute({
      parent,
      path: "share/$id",
      noindex: true,
      pendingComponent: () => <div className="bg-background min-h-svh" />,
      preload: SharedChat.preload,
      loader: (input) => loadSharedChat({ data: input }),
      pageTitle: (data) => data.title,
      component: ({ data }) => <SharedChat share={data} />,
    }),
    createUiRoute({
      parent,
      path: "embed/ai-traffic/$id",
      noindex: true,
      preload: TrafficEmbed.preload,
      loader: (input) => loadTrafficEmbed({ data: input }),
      loaderSearchKeys: ["range"],
      component: ({ data, params, searchParams }) => (
        <TrafficEmbed
          embed={data}
          embedId={params.id}
          parts={
            typeof searchParams.parts === "string"
              ? searchParams.parts
              : undefined
          }
        />
      ),
    }),
    createUiRoute({
      parent,
      path: "callback",
      component: () => null,
      loader: (input) => loadAuthCallback({ data: input }),
    }),
    createUiRoute({
      parent,
      path: "connect/linkedin",
      preload: Linkedin.preload,
      component: () => <Linkedin />,
    }),
    createUiRoute({
      parent,
      path: "integrations/$integrationSlug",
      component: () => null,
      loader: (input) => loadIntegrationEntry({ data: input }),
    }),
    createUiRoute({
      parent,
      path: "api-keys",
      component: () => null,
      loader: () => loadLegacyApiKeys(),
    }),
    createUiRoute({
      parent,
      path: "home",
      component: () => null,
      loader: async () => {
        throw redirect({
          href: "https://www.usenotra.com/home",
          statusCode: 308,
        });
      },
    }),
    createUiRoute({
      parent,
      path: "landing",
      component: () => null,
      loader: async () => {
        throw redirect({
          href: "https://www.usenotra.com/landing",
          statusCode: 308,
        });
      },
    }),
  ];
}
