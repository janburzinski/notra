export interface LinearOAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export interface LinearOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

export type LinearTokenRequestResult =
  | { status: "ok"; tokens: LinearOAuthTokens }
  | { status: "invalid_grant" };

export interface LinearTokenRefreshSummary {
  due: number;
  refreshed: number;
  reconnectRequired: number;
  failed: number;
  deferred: number;
}
