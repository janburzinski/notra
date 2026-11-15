/** The findings a block lists, in the block's order, skipping unknown ids. */
export function findingsInBlockOrder<T extends { id: string }>(
  findingIds: readonly string[],
  findings: readonly T[]
): T[] {
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  return findingIds.flatMap((id) => {
    const finding = byId.get(id);
    return finding ? [finding] : [];
  });
}
