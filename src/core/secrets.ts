import { z } from "zod";

import { apiFetch } from "./api";
import type { SecretProvider } from "./settings/types";

export type ApiKeyProvider = SecretProvider;

const keyStatusSchema = z.object({
  provider: z.enum(["openai", "anthropic"]),
  is_configured: z.boolean(),
  last_four: z.string().nullable(),
});

export interface ApiKeyStatus {
  configured: boolean;
  lastFour: string | null;
}

export async function getApiKeyStatus(
  provider: ApiKeyProvider,
): Promise<ApiKeyStatus> {
  const response = await apiFetch(`keys/${provider}`);
  if (!response.ok) {
    throw new Error(`Could not read API key status (${response.status})`);
  }

  const result = keyStatusSchema.safeParse(await response.json());
  if (!result.success || result.data.provider !== provider) {
    throw new Error("The API returned an invalid key status");
  }

  return {
    configured: result.data.is_configured,
    lastFour: result.data.last_four,
  };
}

export async function saveApiKey(
  provider: ApiKeyProvider,
  apiKey: string,
): Promise<string | null> {
  const response = await apiFetch("keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, api_key: apiKey }),
  });
  if (!response.ok) {
    throw new Error(`Could not save API key (${response.status})`);
  }

  const result = keyStatusSchema.safeParse(await response.json());
  if (!result.success || result.data.provider !== provider) {
    throw new Error("The API returned an invalid key status");
  }

  return result.data.last_four;
}

export async function deleteApiKey(provider: ApiKeyProvider): Promise<void> {
  const response = await apiFetch(`keys/${provider}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Could not delete API key (${response.status})`);
  }
}
