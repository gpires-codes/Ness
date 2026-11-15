import { chatModels, type ChatModel } from "@/core/chat";
import { useTr } from "@/core/i18n";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

interface Props {
  model: ChatModel;
  setModel: (m: ChatModel) => void;
  disabled?: boolean;
}

export function SelectModelButton({ model, setModel, disabled }: Props) {
  const tr = useTr();

  return (
    <div className="mb-2 flex justify-end">
      <Select
        value={model}
        onValueChange={(value) => {
          if (value && isChatModel(value)) setModel(value);
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-64" aria-label={tr("chat.model")}>
          {getModelLabel(model)}
        </SelectTrigger>
        <SelectContent>
          {chatModels.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function isChatModel(value: string): value is ChatModel {
  return chatModels.some((model) => model.id === value);
}

function getModelLabel(model: string): string {
  const label = chatModels.find((m) => m.id === model)?.label ?? model;
  return label.split(" · ").slice(1).join(" · ");
}
