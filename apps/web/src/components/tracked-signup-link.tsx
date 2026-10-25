import { track } from "@databuddy/sdk/react";
import type { ComponentProps, MouseEvent } from "react";

import { AUTH_SIGNUP_URL } from "@/constants/auth";
import { DATABUDDY_SIGNUP_STARTED_EVENT } from "@/utils/databuddy";
import { trackedSignupHref } from "@/utils/signup";

type TrackedSignupLinkProps = Omit<ComponentProps<"a">, "href"> & {
  children?: React.ReactNode;
  href?: string;
  source: string;
};

export function TrackedSignupLink({
  children,
  href = AUTH_SIGNUP_URL,
  onClick,
  source,
  ...props
}: TrackedSignupLinkProps) {
  const trackedHref = trackedSignupHref(source, href);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (event.defaultPrevented) {
      return;
    }

    track(DATABUDDY_SIGNUP_STARTED_EVENT, {
      destination: trackedHref,
      source,
    });
  }

  return (
    <a href={trackedHref} onClick={handleClick} {...props}>
      {children}
    </a>
  );
}
