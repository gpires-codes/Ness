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
          <div className="hidden md:block mt-0.5 text-sm text-muted-foreground">
            <p className="line-clamp-4">{tr(field.description)}</p>
          </div>
        )}
      </div>
      <div
        className={`flex sm:shrink-0 sm:justify-end ${
          field.type === "secret" ? "sm:w-96" : "sm:w-60"
        }`}
      >
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
