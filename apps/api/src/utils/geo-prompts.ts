/**
 * Adds the deprecated, always empty `tags` field to a prompt in an API
 * response. Tags were removed, but clients such as Notra's MCP server still
 * expect the field, so it stays until a future API version drops it.
 */
export function withDeprecatedTags<T extends object>(
  prompt: T
): T & { tags: string[] } {
  return { ...prompt, tags: [] };
}
