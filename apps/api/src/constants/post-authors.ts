import { contentAuthors } from "@notra/db/schema";

export const POST_AUTHOR_LINK_COLUMNS = {
  url: contentAuthors.url,
  x: contentAuthors.x,
  linkedin: contentAuthors.linkedin,
  github: contentAuthors.github,
  youtube: contentAuthors.youtube,
  bluesky: contentAuthors.bluesky,
  mastodon: contentAuthors.mastodon,
  threads: contentAuthors.threads,
  instagram: contentAuthors.instagram,
};
