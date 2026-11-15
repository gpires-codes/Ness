import { useState } from "react";
import { useTranslation } from "react-i18next";

import { createFileRoute } from "@tanstack/react-router";

import {
  chatModels,
  streamChat,
  type ChatModel,
  type ChatTurn,
} from "@/core/chat";

import { ChatInput, SelectModelButton } from "@/components/chat";
import { ChatMessageScroller } from "@/components/chat/ChatMessageScroller";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [model, setModel] = useState<ChatModel>(chatModels[0].id);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;

    const conversation = [...messages, { role: "user" as const, content }];
    const requestMessages = conversation.slice(-50);
    let assistantContent = "";

    setMessages([...conversation, { role: "assistant", content: "" }]);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      await streamChat(model, requestMessages, (streamEvent) => {
        if (streamEvent.type === "delta") {
          assistantContent += streamEvent.text;
        } else if (streamEvent.type === "tool_call") {
          const notice = t("chat.toolNotAvailable", {
            name: streamEvent.name,
          });
          assistantContent = assistantContent
            ? `${assistantContent}\n\n${notice}`
            : notice;
        } else {
          return;
        }

        setMessages((current) => [
          ...current.slice(0, -1),
          { role: "assistant", content: assistantContent },
        ]);
      });
      if (!assistantContent) {
        assistantContent = t("chat.emptyResponse");
        setMessages((current) => [
          ...current.slice(0, -1),
          { role: "assistant", content: assistantContent },
        ]);
      }
    } catch (caught) {
      if (!assistantContent) {
        setMessages(messages);
        setDraft(content);
      }
      setError(
        caught instanceof Error ? caught.message : t("chat.unknownError"),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex flex-col h-full w-full max-w-3xl justify-center py-6">
      <ChatMessageScroller messages={messages} />
      {/* <section
        className="flex-1 space-y-4 pb-6 overflow-auto max-h-[65vh] app-scrollbar"
        aria-label={t("chat.conversation")}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("chat.empty")}</p>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${index}-${message.role}`}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-primary/70 glass px-4 py-3 text-primary-foreground"
                  : "mr-auto max-w-[85%] rounded-2xl glass px-4 py-3"
              }
            >
              {message.content ? (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ) : (
                sending &&
                index === messages.length - 1 && (
                  <p className="text-sm text-muted-foreground">
                    {t("chat.thinking")}
                  </p>
                )
              )}
            </div>
          ))
        )}
      </section> */}

      {error && (
        <p className="mb-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <SelectModelButton model={model} setModel={setModel} disabled={sending} />

      <ChatInput draft={draft} setDraft={setDraft} onSend={sendMessage} />
    </main>
  );
}
