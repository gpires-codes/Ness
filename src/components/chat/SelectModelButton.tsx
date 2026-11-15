import type { ChatModel } from "@/core/chat";
import { useTr } from "@/core/i18n";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

interface Props {
  model: string;
  models: ChatModel[];
  setModel: (model: string) => void;
  disabled?: boolean;
}

export function SelectModelButton({
  model,
  models,
  setModel,
  disabled,
}: Props) {
  const tr = useTr();

  return (
    <div className="mb-2 flex justify-end">
      <Select
        value={model}
        onValueChange={(value) => {
          if (value && models.some((option) => option.id === value)) {
            setModel(value);
          }
        }}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-64" aria-label={tr("chat.model")}>
          {models.find((option) => option.id === model)?.label ?? model}
        </SelectTrigger>
        <SelectContent>
          {models.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
