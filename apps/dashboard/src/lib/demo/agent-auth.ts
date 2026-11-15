import { createRemoteJWKSet, jwtVerify } from "jose";

import {
  DEMO_AGENT_AUTHKIT_DOMAIN,
  DEMO_AGENT_SUBJECT_PREFIX,
} from "@/constants/demo";

const issuer = `https://${DEMO_AGENT_AUTHKIT_DOMAIN}`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/oauth2/jwks`));

export async function verifyDemoAgentToken(
  token: string
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, jwks, { issuer });
    return payload.sub?.startsWith(DEMO_AGENT_SUBJECT_PREFIX)
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}
