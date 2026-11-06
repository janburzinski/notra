export const POST_TAG_MAX_LENGTH = 40;
export const POST_TAGS_MAX = 12;
/** Tags a writer agent should pick for one post. */
export const POST_GENERATED_TAGS_MAX = 4;
export const POST_EXCERPT_MAX_LENGTH = 300;
export const POST_COVER_ALT_MAX_LENGTH = 300;
export const POST_COVER_URL_MAX_LENGTH = 2048;
export const POST_AUTHORS_MAX = 5;
/** Existing tags getPostDetails shows the model. */
export const POST_DETAILS_TAG_SUGGESTIONS = 30;
/** A leading YAML frontmatter block, e.g. from a pasted .mdx file. */
export const LEADING_FRONTMATTER =
  /^﻿?\s*---\r?\n(?=[A-Za-z_][\w-]*:)[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** Object-key suffix that marks a cover Notra generated, so it can be refreshed. */
export const GENERATED_COVER_KEY_SUFFIX = "-cover";
/** Random per cover, so a draft or past cover URL cannot be guessed. */
export const GENERATED_COVER_URL =
  /\/content\/[^/]+-cover-[0-9a-f-]{36}-\d+\.png$/;
/** Publishing never waits longer than this for an optional cover. */
export const GENERATED_COVER_TIMEOUT_MS = 10_000;
