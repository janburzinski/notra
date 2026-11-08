/** A Design publish found no blog.json change left to commit. */
export class SiteDesignUnchangedError extends Error {
  constructor() {
    super("blog.json has no unpublished changes");
    this.name = "SiteDesignUnchangedError";
  }
}
