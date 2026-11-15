import { cn } from "cn";
import { Copy, Loader } from "lucide-react";

import { shouldShowThinkingLoader, type ChatTurn } from "@/core/chat";

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller";
import {
  Message,
  MessageContent,
  MessageFooter,
  MessageHeader,
} from "@/components/ui/message";
import { Button } from "@/components/ui/button";

interface Props {
  messages: ChatTurn[];
  emptyMessage: string;
  isLoading: boolean;
}

export function ChatMessageScroller({
  messages,
  emptyMessage,
  isLoading,
}: Props) {
  const showThinkingLoader = shouldShowThinkingLoader(messages, isLoading);
  let lastUserIndex = -1;
  for (let index = 0; index < messages.length; index += 1) {
    if (messages[index].role === "user") lastUserIndex = index;
  }
  const pendingAssistant = messages
    .slice(lastUserIndex + 1)
    .find((message) => message.role === "assistant");
  const isEmpty = messages.length === 0 && !showThinkingLoader;

  return (
    <MessageScrollerProvider>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {emptyMessage}
        </p>
      ) : (
        <MessageScroller>
          <MessageScrollerViewport
            className={cn("app-scrollbar scroll-fade-8")}
          >
            <MessageScrollerContent>
              {messages.map((message) => (
                <MessageScrollerItem
                  key={message.id}
                  messageId={message.id}
                  scrollAnchor={message.role === "user"}
                >
                  {message.content ? (
                    <Message
                      className="group/message"
                      align={message.role === "user" ? "end" : "start"}
                    >
                      <MessageContent className="gap-1">
                        <MessageHeader></MessageHeader>
                        <div
                          data-slot="message-bubble"
                          className={cn(
                            "glass p-2 rounded-lg max-w-[80%] w-fit",
                            message.role === "user" && "bg-background",
                            // message.attachments?.length ? "space-y-2" : null, // attachments
                          )}
                        >
                          {/* attachments */}
                          {/* <div
                          className={cn(
                            "app-scrollbar overflow-x-auto max-w-full flex flex-row gap-1",
                          )}
                        >
                          {message.attachments?.map((att) =>
                            att.type.startsWith("image/") ? (
                              <img
                                key={att.id}
                                src={att.url}
                                className="rounded-md max-h-32 shrink-0"
                              />
                            ) : (
                              <div
                                key={att.id}
                                className="text-xs bg-muted rounded px-2 py-1 shrink-0 whitespace-nowrap"
                              >
                                {att.name}
                              </div>
                            ),
                          )}
                        </div> */}

                          <div className="whitespace-pre-wrap break-words text-[14px]">
                            {message.content}
                          </div>
                        </div>

                        <MessageFooter className="p-0 opacity-0 transition-opacity group-hover/message:opacity-100 group-focus-within/message:opacity-100">
                          <Button
                            className="size-6"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(message.content);
                            }}
                          >
                            <Copy />
                          </Button>
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  ) : showThinkingLoader &&
                    message.id === pendingAssistant?.id ? (
                    <Loader className="w-4 h-4 animate-spin shimmer text-muted-foreground" />
                  ) : null}
                </MessageScrollerItem>
              ))}
              {showThinkingLoader && !pendingAssistant && (
                <MessageScrollerItem
                  key={`thinking-${messages[lastUserIndex]?.id ?? "chat"}`}
                  messageId={`thinking-${messages[lastUserIndex]?.id ?? "chat"}`}
                  scrollAnchor={false}
                >
                  <Loader className="w-4 h-4 animate-spin shimmer text-muted-foreground" />
                </MessageScrollerItem>
              )}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton />
        </MessageScroller>
      )}
    </MessageScrollerProvider>
  );
}
