export function GET() {
  return Response.json(
    {
      ok: true,
      time: new Date().toISOString(),
      commitSha:
        process.env.UNKEY_GIT_COMMIT_SHA ??
        process.env.VERCEL_GIT_COMMIT_SHA ??
        null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
