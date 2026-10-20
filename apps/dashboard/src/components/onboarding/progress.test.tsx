import { expect, test } from "bun:test";

import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { renderToStaticMarkup } from "react-dom/server";
import { IntlProvider } from "use-intl";

import { ONBOARDING_STEP_PRICING } from "@/constants/onboarding";
import { onboardingProgressHrefs } from "@/utils/onboarding-progress";

import messages from "../../../messages/en.json";
import { OnboardingProgress } from "./progress";

test.each([
  [false, "Step 4 of 4"],
  [true, "Step 5 of 5"],
])(
  "pricing progress follows the Autopilot flag (autopilot=%s)",
  (autopilot, label) => {
    const router = createRouter({
      routeTree: createRootRoute(),
      history: createMemoryHistory(),
    });
    const html = renderToStaticMarkup(
      <RouterContextProvider router={router}>
        <IntlProvider locale="en" messages={messages}>
          <OnboardingProgress
            current={ONBOARDING_STEP_PRICING}
            hrefs={onboardingProgressHrefs({
              autopilot,
              current: ONBOARDING_STEP_PRICING,
              hasBrand: true,
              hasOrganization: true,
              stage: "complete",
            })}
          />
        </IntlProvider>
      </RouterContextProvider>
    );

    expect(html).toContain(`aria-label="${label}"`);
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html.includes('aria-label="Go to Autopilot"')).toBe(autopilot);
  }
);

test("progress without hrefs shows the base four-step flow", () => {
  const html = renderToStaticMarkup(
    <IntlProvider locale="en" messages={messages}>
      <OnboardingProgress current={1} />
    </IntlProvider>
  );
  expect(html).toContain('aria-label="Step 1 of 4"');
});
