import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./api";
import { getModels } from "./chat";

vi.mock("./api", () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

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
