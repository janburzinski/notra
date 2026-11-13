export class LinearReconnectRequiredError extends Error {
  constructor(integrationId: string) {
    super(
      `Linear access for integration ${integrationId} expired or was revoked. Reconnect Linear in Notra's integration settings.`
    );
    this.name = "LinearReconnectRequiredError";
  }
}

export class LinearTokenRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LinearTokenRequestError";
    this.status = status;
  }
}

export class LinearOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      "The Linear access token expired and cannot be refreshed because LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET are not set."
    );
    this.name = "LinearOAuthNotConfiguredError";
  }
}
