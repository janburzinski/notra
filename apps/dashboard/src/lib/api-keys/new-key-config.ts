import { DEFAULT_NEW_KEY_CONFIG } from "@/constants/api-keys";
import type {
  ApiKeyCreateConfig,
  ApiKeyCreateErrorField,
  NewKeyConfigState,
} from "@/types/api-keys";

export function hasCompleteNewKeyConfig(config: NewKeyConfigState): boolean {
  return (
    config.name !== null && config.scopes !== null && config.expiration !== null
  );
}

export function apiKeyCreateInput(
  config: NewKeyConfigState
): ApiKeyCreateConfig {
  return {
    name: config.name ?? DEFAULT_NEW_KEY_CONFIG.name,
    accessMode: config.accessMode ?? DEFAULT_NEW_KEY_CONFIG.accessMode,
    scopes: config.scopes ?? DEFAULT_NEW_KEY_CONFIG.scopes,
    expiration: config.expiration ?? DEFAULT_NEW_KEY_CONFIG.expiration,
  };
}

export function apiKeyCreateErrorField(
  field: PropertyKey | undefined
): ApiKeyCreateErrorField {
  return field === "name" || field === "scopes" ? field : "invalid";
}
