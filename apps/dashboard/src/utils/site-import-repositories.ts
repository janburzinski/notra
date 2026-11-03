import type { SiteImportListProps } from "@/types/components/sites";
import type { SiteImportableRepository } from "@/types/sites";

type CurrentRepository = SiteImportListProps["currentRepository"];

export function isCurrentSiteRepository(
  repository: Pick<SiteImportableRepository, "owner" | "repo">,
  current: CurrentRepository
) {
  return (
    Boolean(current) &&
    repository.owner.toLowerCase() === current?.owner.toLowerCase() &&
    repository.repo.toLowerCase() === current?.name.toLowerCase()
  );
}

/** The current repository first, then already connected ones, then by name; filtered by owner and search. */
export function visibleSiteImportRepositories(params: {
  repositories: SiteImportableRepository[];
  currentRepository: CurrentRepository;
  owner: string | null;
  search: string;
}) {
  const query = params.search.trim().toLowerCase();
  const isCurrent = (repository: SiteImportableRepository) =>
    isCurrentSiteRepository(repository, params.currentRepository);
  return params.repositories
    .toSorted(
      (a, b) =>
        Number(isCurrent(b)) - Number(isCurrent(a)) ||
        Number(b.integrationId !== null) - Number(a.integrationId !== null) ||
        a.repo.localeCompare(b.repo)
    )
    .filter(
      (repository) =>
        (!params.owner || repository.owner === params.owner) &&
        repository.repo.toLowerCase().includes(query)
    );
}
