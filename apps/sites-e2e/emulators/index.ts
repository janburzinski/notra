import { readFile } from "node:fs/promises";

import { startAutumnEmulator } from "./autumn";
import { startBoxEmulator } from "./box";
import { startCloudflareEmulator } from "./cloudflare";
import { summarizeRequests } from "./core/summary";
import type { EmulatorSummary } from "./core/types";
import { startDnsServer } from "./dns/server";
import { DnsZone } from "./dns/zone";
import { startGitHubEmulator } from "./github";
import { startGoogleFontsEmulator } from "./google-fonts";
import { EMULATED_GOOGLE_FONT } from "./google-fonts/constants";
import { startR2Emulator } from "./r2";
import type { SitesEmulatorsOptions } from "./types";
import { startVercelEmulator } from "./vercel";

// Every external service the Sites backend talks to, emulated on loopback.
// `env` points the backend at them (see packages/sites-server/src/utils/
// provider-urls.ts); `summaries()` reports which routes each one served and
// any request no route handled. To emulate a new provider: add a directory
// with a `start…Emulator` built on `startEmulator`, give the backend an
// override in provider-urls.ts and register it here.
export async function startSitesEmulators(options: SitesEmulatorsOptions) {
  const zone = new DnsZone();
  // Close whatever already started when a later emulator fails to start.
  const started: { close(): Promise<void> }[] = [];
  const track = async <T extends { close(): Promise<void> }>(
    starting: Promise<T>
  ) => {
    const service = await starting;
    started.push(service);
    return service;
  };
  try {
    const dns = await track(startDnsServer(zone));
    const github = await track(
      startGitHubEmulator({ ...options.github, directory: options.directory })
    );
    const r2 = await track(
      startR2Emulator({
        bucket: "notra-sites-e2e",
        accessKeyId: "EMULATEDR2ACCESSKEY",
        // Below R2's 1000 so prefix deletes and listings walk several pages.
        pageSize: 25,
      })
    );
    const cloudflare = await track(
      startCloudflareEmulator(
        {
          zoneId: "emulated-saas-zone",
          apiToken: "emulated-cloudflare-token",
          cnameTarget: `cname.${options.hostingDomain}`,
        },
        zone
      )
    );
    const vercel = await track(
      startVercelEmulator(
        {
          clientId: "emulated-vercel-client",
          clientSecret: "emulated-vercel-secret",
          redirectUri: `${options.dashboardUrl}/sites/vercel-dns`,
          zones: options.vercelZones,
        },
        zone
      )
    );
    const autumn = await track(
      startAutumnEmulator({ secretKey: "emulated-autumn-secret" })
    );
    const googleFonts = await track(
      startGoogleFontsEmulator({
        families: {
          [EMULATED_GOOGLE_FONT]: {
            file: new Uint8Array(
              await readFile(
                new URL(
                  "../fixtures/site/public/fonts/e2e-text-400.woff2",
                  import.meta.url
                )
              )
            ),
            license: `Copyright 2026 The ${EMULATED_GOOGLE_FONT} Project Authors\n\nSIL Open Font License, Version 1.1\n`,
            weights: [100, 900],
          },
        },
      })
    );
    const box = options.box
      ? await track(
          startBoxEmulator({
            directory: options.directory,
            apiKey: "emulated-box-key",
          })
        )
      : null;
    const services = [
      github,
      r2,
      box,
      cloudflare,
      vercel,
      autumn,
      googleFonts,
      dns,
    ].filter((service) => service !== null);
    return {
      zone,
      dns,
      github,
      r2,
      cloudflare,
      vercel,
      autumn,
      googleFonts,
      box,
      env: {
        ...dns.env,
        ...github.env,
        ...r2.env,
        ...cloudflare.env,
        ...vercel.env,
        ...autumn.env,
        ...googleFonts.env,
        ...(box?.env ?? {}),
      },
      summaries: (): EmulatorSummary[] =>
        services.map((service) =>
          summarizeRequests(service.name, service.requests)
        ),
      close: async () => {
        for (const service of services.toReversed()) {
          await service.close();
        }
      },
    };
  } catch (error) {
    for (const service of started.toReversed()) {
      await service.close().catch(() => undefined);
    }
    throw error;
  }
}
