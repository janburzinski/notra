import { EmulatorError, startEmulator } from "../core/service";

// The shared IndexNow endpoint as Sites submits to it after a production
// build. Like the real one, it answers 422 when a URL is outside the host or
// the key location's path, and 200 otherwise.
export async function startIndexNowEmulator() {
  const server = await startEmulator("indexnow", [
    {
      method: "POST",
      path: "/indexnow",
      handle: async (request) => {
        const body: unknown = await request.json();
        if (
          !(
            body &&
            typeof body === "object" &&
            "host" in body &&
            "key" in body &&
            "keyLocation" in body &&
            "urlList" in body &&
            typeof body.host === "string" &&
            typeof body.key === "string" &&
            typeof body.keyLocation === "string" &&
            Array.isArray(body.urlList)
          )
        ) {
          throw new EmulatorError(400, "Malformed IndexNow submission");
        }
        const scope = body.keyLocation.slice(
          0,
          body.keyLocation.lastIndexOf("/") + 1
        );
        for (const url of body.urlList) {
          if (
            !(
              typeof url === "string" &&
              new URL(url).hostname === body.host &&
              url.startsWith(scope)
            )
          ) {
            throw new EmulatorError(422, `URL outside the key scope: ${url}`);
          }
        }
        return new Response(null, { status: 200 });
      },
    },
  ]);
  return {
    ...server,
    env: { SITES_INDEXNOW_URL: `${server.url}/indexnow` },
  };
}
