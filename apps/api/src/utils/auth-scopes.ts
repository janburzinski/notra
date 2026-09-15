import {
  getRequiredApiScope,
  isApiMutationMethod,
  isUnscopedApiPath,
  LEGACY_API_READ_SCOPE,
  LEGACY_API_WRITE_SCOPE,
} from "@notra/utils/api-scopes";

export function getApiAuthRequirements(pathname: string, method: string) {
  const permissions = getRequiredApiScope(pathname, method);
  if (!permissions) {
    return isUnscopedApiPath(pathname) ? { legacyPermissions: [] } : null;
  }

  return {
    permissions,
    legacyPermissions: isApiMutationMethod(method)
      ? [LEGACY_API_WRITE_SCOPE]
      : [LEGACY_API_READ_SCOPE, LEGACY_API_WRITE_SCOPE],
  };
}
