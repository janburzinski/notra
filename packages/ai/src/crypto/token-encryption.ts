import {
  decodeIntegrationEncryptionKey,
  decodePreviousIntegrationEncryptionKey,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
} from "@notra/db/utils/integration-encryption";

function getEncryptionKey() {
  return decodeIntegrationEncryptionKey(process.env.INTEGRATION_ENCRYPTION_KEY);
}

export function encryptToken(token: string) {
  return encryptIntegrationSecret(token, getEncryptionKey());
}

export function decryptToken(encryptedToken: string) {
  try {
    return decryptIntegrationSecret(encryptedToken, getEncryptionKey());
  } catch (error) {
    const previousKey = decodePreviousIntegrationEncryptionKey();
    if (!previousKey) {
      throw error;
    }
    return decryptIntegrationSecret(encryptedToken, previousKey);
  }
}
