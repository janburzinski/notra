import { aiTrendsRouter } from "./routers/ai-trends";
import { autopilotRouter } from "./routers/autopilot";
import { integrationsRouter } from "./routers/integrations";
import { reviewRouter } from "./routers/review";
import { sitesRouter } from "./routers/sites";

export const consoleRouter = {
  aiTrends: aiTrendsRouter,
  autopilot: autopilotRouter,
  integrations: integrationsRouter,
  review: reviewRouter,
  sites: sitesRouter,
};

export type ConsoleRouter = typeof consoleRouter;
