import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { createFileRoute } from "@tanstack/react-router";

import { ChatInput, SelectModelButton } from "@/components/chat";
import { ChatMessageScroller } from "@/components/chat/ChatMessageScroller";
import { apiFetchUrl, API_BASE_URL } from "@/core/api";
import { openKV, type KV } from "@/core/platform";
import {
  getModels,
  resolveSelectedModel,
  type ChatModel,
  type ChatTurn,
} from "@/core/chat";

const chatConnection = fetchServerSentEvents(`${API_BASE_URL}chat`, {
  fetchClient: apiFetchUrl,
});
const CHAT_PREFERENCES_FILE = "chat.json";
const SELECTED_MODEL_KEY = "selectedModel";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useTranslation();
  const [threadId] = useState(() => crypto.randomUUID());
  const [models, setModels] = useState<ChatModel[]>([]);
  const [model, setModel] = useState("");
  const [modelError, setModelError] = useState<string | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const preferencesRef = useRef<KV | null>(null);

  const chat = useChat({
    connection: chatConnection,
    threadId,
    forwardedProps: { model },
  });

  useEffect(() => {
    let active = true;
    async function loadModels() {
      try {
        const availableModels = await getModels("chat");
        let preferredModel: unknown;

        try {
          const preferences = await openKV(CHAT_PREFERENCES_FILE);
          preferredModel = await preferences.get(SELECTED_MODEL_KEY);
          if (active) preferencesRef.current = preferences;
        } catch (error: unknown) {
          if (active) {
            setPreferenceError(
              error instanceof Error ? error.message : t("chat.unknownError"),
            );
          }
        }

        if (!active) return;
        setModels(availableModels);
        setModel(resolveSelectedModel(availableModels, preferredModel));
      } catch (error: unknown) {
        if (active) {
          setModelError(
            error instanceof Error ? error.message : t("chat.unknownError"),
          );
        }
      }
    }

    void loadModels();

    return () => {
      active = false;
      preferencesRef.current = null;
    };
  }, [t]);

  const displayMessages = useMemo<ChatTurn[]>(
    () =>
      chat.messages.flatMap((message) => {
        if (message.role !== "user" && message.role !== "assistant") return [];
        return [
          {
            id: message.id,
            role: message.role,
            content: message.parts
              .map((part) => {
                if (part.type === "text") return part.content;
                if (part.type === "tool-call") {
                  return t("chat.toolNotAvailable", { name: part.name });
                }
                return "";
              })
              .filter(Boolean)
              .join("\n\n"),
          },
        ];
      }),
    [chat.messages, t],
  );

  function sendMessage(text: string) {
    const content = text.trim();
    if (!content || chat.isLoading || !model) return;
    setDraft("");
    void chat.sendMessage(content);
  }

  function selectModel(selectedModel: string) {
    if (!models.some((option) => option.id === selectedModel)) return;

    setModel(selectedModel);
    const preferences = preferencesRef.current;
    if (!preferences) return;

    void preferences
      .set(SELECTED_MODEL_KEY, selectedModel)
      .then(() => setPreferenceError(null))
      .catch((error: unknown) => {
        setPreferenceError(
          error instanceof Error ? error.message : t("chat.unknownError"),
        );
      });
  }

  const error = modelError ?? preferenceError ?? chat.error?.message;

  return (
    <main className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center py-6">
      <ChatMessageScroller
        messages={displayMessages}
        emptyMessage={t("chat.empty")}
        isLoading={chat.isLoading}
      />

      {error && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <SelectModelButton
        model={model}
        models={models}
        setModel={selectModel}
        disabled={chat.isLoading || models.length === 0}
      />

      <ChatInput
        draft={draft}
        setDraft={setDraft}
        onSend={sendMessage}
        disabled={chat.isLoading || models.length === 0}
      />
    </main>
  );
}
