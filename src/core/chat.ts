import { z } from "zod";

import { apiFetch } from "./api";

export const modelCapabilities = ["chat", "stt", "tts"] as const;
export type ModelCapability = (typeof modelCapabilities)[number];

const chatModelSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  provider: z.string().min(1),
  capabilities: z.array(z.enum(modelCapabilities)),
});

export type ChatModel = z.infer<typeof chatModelSchema>;
export type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const chatModelsSchema = z.array(chatModelSchema);
const errorSchema = z.object({ detail: z.string() });

export async function getModels(
  capability: ModelCapability,
): Promise<ChatModel[]> {
  const response = await apiFetch(
    `chat/models?capability=${encodeURIComponent(capability)}`,
  );
  if (!response.ok) {
    let message = `Could not load ${capability} models (${response.status})`;
    try {
      const error = errorSchema.safeParse(await response.json());
      if (error.success) message = error.data.detail;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }

  const result = chatModelsSchema.safeParse(await response.json());
  if (
    !result.success ||
    result.data.some((model) => !model.capabilities.includes(capability))
  ) {
    throw new Error("The API returned an invalid model catalog");
  }
  return result.data;
}
