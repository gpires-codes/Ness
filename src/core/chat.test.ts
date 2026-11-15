import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api";
import {
  getModels,
  resolveSelectedModel,
  shouldShowThinkingLoader,
  type ChatModel,
} from "./chat";

vi.mock("./api", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

describe("resolveSelectedModel", () => {
  const models: ChatModel[] = [
    {
      id: "openai:gpt-4o",
      label: "GPT-4o",
      provider: "openai",
      capabilities: ["chat"],
    },
    {
      id: "anthropic:claude",
      label: "Claude",
      provider: "anthropic",
      capabilities: ["chat"],
    },
  ];

  it("keeps the saved model when it is still available", () => {
    expect(resolveSelectedModel(models, "anthropic:claude")).toBe(
      "anthropic:claude",
    );
  });

  it("falls back to the first model when the saved choice is unavailable", () => {
    expect(resolveSelectedModel(models, "removed:model")).toBe("openai:gpt-4o");
    expect(resolveSelectedModel([], "anthropic:claude")).toBe("");
  });
});

describe("shouldShowThinkingLoader", () => {
  it("shows while waiting for the current assistant response", () => {
    expect(
      shouldShowThinkingLoader(
        [
          { id: "user-1", role: "user", content: "Olá" },
          { id: "assistant-1", role: "assistant", content: "Oi" },
          { id: "user-2", role: "user", content: "Tudo bem?" },
        ],
        true,
      ),
    ).toBe(true);
  });

  it("hides after the current assistant response starts and when idle", () => {
    const messages = [
      { id: "user-1", role: "user", content: "Olá" },
      { id: "assistant-1", role: "assistant", content: "Oi" },
    ] as const;

    expect(shouldShowThinkingLoader([...messages], true)).toBe(false);
    expect(
      shouldShowThinkingLoader(
        [{ id: "user-2", role: "user", content: "Tudo bem?" }],
        false,
      ),
    ).toBe(false);
  });
});

describe("getModels", () => {
  beforeEach(() => {
    mockedApiFetch.mockReset();
  });

  it("returns models that support the requested capability", async () => {
    mockedApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "openai:gpt-4o",
            label: "GPT-4o",
            provider: "openai",
            capabilities: ["chat"],
          },
        ]),
        { status: 200 },
      ),
    );

    await expect(getModels("chat")).resolves.toEqual([
      {
        id: "openai:gpt-4o",
        label: "GPT-4o",
        provider: "openai",
        capabilities: ["chat"],
      },
    ]);
    expect(mockedApiFetch).toHaveBeenCalledWith("chat/models?capability=chat");
  });

  it("rejects a catalog containing a model without the requested capability", async () => {
    mockedApiFetch.mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "whisper:large",
            label: "Whisper Large",
            provider: "whisper",
            capabilities: ["stt"],
          },
        ]),
        { status: 200 },
      ),
    );

    await expect(getModels("chat")).rejects.toThrow(
      "The API returned an invalid model catalog",
    );
  });
});
