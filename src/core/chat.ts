import { z } from "zod";

import { apiFetch } from "./api";

export const chatModels = [
  { id: "openai:gpt-4o-mini", label: "OpenAI · GPT-4o mini" },
  { id: "openai:gpt-4o", label: "OpenAI · GPT-4o" },
  { id: "anthropic:claude-sonnet-5", label: "Anthropic · Claude Sonnet 5" },
  { id: "anthropic:claude-haiku-4-5", label: "Anthropic · Claude Haiku 4.5" },
] as const;

export type ChatModel = (typeof chatModels)[number]["id"];

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool_call"; name: string; parameters: Record<string, unknown> }
  | { type: "done" };

const deltaSchema = z.object({ text: z.string() });
const toolCallSchema = z.object({
  name: z.string(),
  parameters: z.record(z.string(), z.unknown()),
});
const errorSchema = z.object({ message: z.string() });
const httpErrorSchema = z.object({ detail: z.string() });

function parseFrame(frame: string): { event: string; data: string } | null {
  let event = "message";
  const data: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);

    if (field === "event") event = value;
    if (field === "data") data.push(value);
  }

  return data.length ? { event, data: data.join("\n") } : null;
}

export async function streamChat(
  model: ChatModel,
  messages: ChatTurn[],
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const response = await apiFetch("chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages: messages.slice(-50) }),
  });

  if (!response.ok) {
    let message = `Chat request failed (${response.status})`;
    try {
      const error = httpErrorSchema.safeParse(await response.json());
      if (error.success) message = error.data.detail;
    } catch {
      // Keep the HTTP status message when the response is not JSON.
    }
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("The chat response did not include a readable stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;

  const dispatch = (frame: string) => {
    const parsed = parseFrame(frame);
    if (!parsed) return;

    if (parsed.event === "start") return;
    if (parsed.event === "delta") {
      const result = deltaSchema.safeParse(JSON.parse(parsed.data));
      if (!result.success) throw new Error("Invalid text event in chat stream");
      onEvent({ type: "delta", text: result.data.text });
      return;
    }
    if (parsed.event === "tool_call") {
      const result = toolCallSchema.safeParse(JSON.parse(parsed.data));
      if (!result.success) throw new Error("Invalid tool event in chat stream");
      onEvent({
        type: "tool_call",
        name: result.data.name,
        parameters: result.data.parameters,
      });
      return;
    }
    if (parsed.event === "done") {
      completed = true;
      onEvent({ type: "done" });
      return;
    }
    if (parsed.event === "error") {
      const result = errorSchema.safeParse(JSON.parse(parsed.data));
      throw new Error(
        result.success ? result.data.message : "The chat request failed",
      );
    }

    throw new Error(`Unknown chat event: ${parsed.event}`);
  };

  const consumeFrames = () => {
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      dispatch(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        consumeFrames();
        if (buffer.trim()) dispatch(buffer);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      consumeFrames();
    }
  } finally {
    reader.releaseLock();
  }

  if (!completed) {
    throw new Error("The chat stream ended before completion");
  }
}
