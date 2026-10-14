import { isBrewConfigured } from "@notra/email/utils/brew";
import { isDemoMode } from "@notra/utils/demo-mode";

import { pruneBrewContacts, syncBrewContacts } from "@/lib/email/brew-contacts";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (isDemoMode()) {
    return new Response(null, { status: 204 });
  }
  if (!isBrewConfigured()) {
    return Response.json({ error: "BREW_API_KEY is not set" }, { status: 503 });
  }

  const result = await syncBrewContacts();
  const { pruned } = await pruneBrewContacts();
  return Response.json(
    { ...result, pruned },
    { status: result.failed > 0 ? 500 : 200 }
  );
}
