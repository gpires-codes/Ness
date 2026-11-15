import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchServerSentEvents, useChat } from "@tanstack/ai-react";
import { createFileRoute } from "@tanstack/react-router";

import { ChatInput, SelectModelButton } from "@/components/chat";
import { ChatMessageScroller } from "@/components/chat/ChatMessageScroller";
import { apiFetchUrl, API_BASE_URL } from "@/core/api";
import { getModels, type ChatModel, type ChatTurn } from "@/core/chat";

const chatConnection = fetchServerSentEvents(`${API_BASE_URL}chat`, {
  fetchClient: apiFetchUrl,
});

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useTranslation();
  const [threadId] = useState(() => crypto.randomUUID());
  const [models, setModels] = useState<ChatModel[]>([]);
  const [model, setModel] = useState("");
  const [modelError, setModelError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const chat = useChat({
    connection: chatConnection,
    threadId,
    forwardedProps: { model },
  });

  useEffect(() => {
    let active = true;
    getModels("chat")
      .then((availableModels) => {
        if (!active) return;
        setModels(availableModels);
        setModel((current) =>
          availableModels.some((option) => option.id === current)
            ? current
            : (availableModels[0]?.id ?? ""),
        );
      })
      .catch((error: unknown) => {
        if (active) {
          setModelError(
            error instanceof Error ? error.message : t("chat.unknownError"),
          );
        }
      });

    return () => {
      active = false;
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

  const error = modelError ?? chat.error?.message;

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
        setModel={setModel}
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
