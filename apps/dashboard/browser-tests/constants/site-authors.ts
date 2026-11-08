export const SITE_AUTHORS_HTML = `<!doctype html>
<html lang="en" data-dashboard-root>
<head><meta charset="utf-8"><title>Sites authors regression</title><link rel="stylesheet" href="/fixture.css"></head>
<body><div id="root"></div>
<script>window.process = { env: {} };</script>
<script type="module" src="/fixture.js"></script></body>
</html>`;

/** A flat square served for every avatar, so no test reaches the network. */
export const SITE_AUTHORS_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#8b5cf6"/></svg>`;

/** A 2×2 PNG for the avatar upload, base64. */
export const SITE_AUTHORS_AVATAR_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGPojvnWHfONAUIBADKOB3WdSBrzAAAAAElFTkSuQmCC";
