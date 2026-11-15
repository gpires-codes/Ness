import { cn } from "cn";
import { ArrowUp } from "lucide-react";
import { useRef } from "react";
import TextareaAutosize from "react-textarea-autosize";

import { useTr } from "@/core/i18n";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";

interface ChatInputProps {
  className?: string;
  draft: string;
  setDraft: (draft: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({
  className,
  draft,
  setDraft,
  onSend,
  disabled = false,
}: ChatInputProps) {
  const tr = useTr();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (disabled || !draft.trim()) return;
    onSend(draft);
  };

  return (
    <div className={cn(className, "flex flex-col gap-2 w-full")}>
      <InputGroup
        className="pt-2"
        onClick={(e) => {
          if (!(e.target as HTMLElement).closest("button"))
            textareaRef.current?.focus();
        }}
      >
        <TextareaAutosize
          className={
            "app-scrollbar flex field-sizing-content min-h-12 max-h-[35vh] w-full resize-none rounded-md px-3 text-base outline-none md:text-sm"
          }
          ref={textareaRef}
          value={draft}
          placeholder={tr("chat.placeholder")}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />

        <InputGroupAddon align="block-end">
          <InputGroupButton
            className="ml-auto aria-disabled:opacity-50"
            size="icon-sm"
            variant="default"
            disabled={disabled}
            aria-disabled={!draft.trim()}
            onClick={handleSend}
          >
            <ArrowUp strokeWidth={2.5} />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
