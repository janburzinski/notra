# notra-script

Cloudflare Worker that serves `notra.js`, `notra.plus.js` and every pinned
`notra[.plus].<version>.js` at `https://static.usenotra.com`, from Cloudflare's
edge. It uses the ingest's response code (`@notra/web-tracker/response`), so
cache headers, ETags and the pinned builds' integrity are the same. The files
also answer at the ingest's `/api/...` paths.

Page views never come here: the tags Notra hands out set `data-api` to the
ingest's `/api/collect`. A tag without it would post to this host, which answers
404; a redirect would not help, because browsers send `Origin: null` after a
cross-origin redirect and the ingest drops beacons from other origins.

```sh
bun run test          # handler tests
bun run dev           # wrangler dev
bun run deploy        # wrangler deploy (the production release runs this)
```

A tracker change ships here with the next deploy: rebuild `packages/web-tracker`
first, as for the ingest.
