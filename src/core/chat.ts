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

export function shouldShowThinkingLoader(
  messages: ChatTurn[],
  isLoading: boolean,
): boolean {
  if (!isLoading) return false;

  let lastUserIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index].role === "user") lastUserIndex = index;
  }
  if (lastUserIndex === -1) return messages.length === 0;

  return !messages
    .slice(lastUserIndex + 1)
    .some((message) => message.role === "assistant" && message.content.length > 0);
}

const chatModelsSchema = z.array(chatModelSchema);
const errorSchema = z.object({ detail: z.string() });

export function resolveSelectedModel(
  models: ChatModel[],
  preferredModel: unknown,
): string {
  if (
    typeof preferredModel === "string" &&
    models.some((model) => model.id === preferredModel)
  ) {
    return preferredModel;
  }
  return models[0]?.id ?? "";
}

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
