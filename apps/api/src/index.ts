import { type UnkeyContext, unkey } from "@unkey/hono";
import { Hono } from "hono";
import { trimTrailingSlash } from "hono/trailing-slash";
import { contentRoutes } from "./routes/content";

interface Bindings {
  UNKEY_ROOT_KEY: string;
}

const app = new Hono<{
  Bindings: Bindings;
  Variables: { unkey: UnkeyContext };
}>({ strict: true });

app.use(trimTrailingSlash({ alwaysRedirect: true }));
app.use("/v1/*", async (c, next) => {
  const handler = unkey({
    rootKey: c.env.UNKEY_ROOT_KEY,
  });
  return handler(c, next);
});

app.get("/", (c) => {
  return c.text("ok");
});

app.route("/v1", contentRoutes);

export default app;
