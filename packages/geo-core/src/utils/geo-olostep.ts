import { GEO_OLOSTEP_ENGINES } from "../constants/geo-olostep";

export function isGeoOlostepEngine(engine: string): boolean {
  return engine in GEO_OLOSTEP_ENGINES;
}

/** Olostep engines that can hold a sequence or persona conversation. */
export function isGeoOlostepConversationEngine(engine: string): boolean {
  return GEO_OLOSTEP_ENGINES[engine]?.conversational === true;
}
