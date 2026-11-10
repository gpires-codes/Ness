import { useId } from "react";

import { useTr } from "@/core/i18n";
import type { Field } from "@/core/settings/types";

import { Label } from "@/components/ui/label";

import { useSettings } from "../SettingsProvider";
import { Control } from "./controls";

export function Row({ field }: { field: Field }) {
  const { values, set } = useSettings();
  const tr = useTr();
  const id = useId();

  return (
    <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <Label htmlFor={id}>{tr(field.label)}</Label>
        {field.description && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            {tr(field.description)}
          </p>
        )}
      </div>
      <div className="flex sm:w-60 sm:shrink-0 sm:justify-end">
        <Control
          field={field}
          id={id}
          value={values[field.key]}
          onChange={(v) => set(field.key, v)}
        />
      </div>
    </div>
  );
}
