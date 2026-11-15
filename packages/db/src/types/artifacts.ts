/**
 * One saved version of an artifact. Blocks are validated when they are
 * written and parsed again when read, so a block kind the renderer no longer
 * knows is skipped instead of breaking the page.
 */
export interface StoredArtifactContent {
  title: string;
  summary?: string | null;
  blocks: unknown[];
}
