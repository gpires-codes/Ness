import { useEffect, useState } from "react";

import { useTr } from "@/core/i18n";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { isTauri } from "@/core/platform";
import type { Field, NumberField, PathField } from "@/core/settings/types";
import { optionsOf, validatorOf } from "@/core/settings/engine";
import { SecretControl } from "./SecretControl";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface CtlProps<F extends Field> {
  field: F;
  id: string;
  value: unknown;
  onChange: (v: unknown) => void;
}

export function Control({ field, id, value, onChange }: CtlProps<Field>) {
  const tr = useTr();

  switch (field.type) {
    case "toggle":
      return (
        <Switch id={id} checked={value === true} onCheckedChange={onChange} />
      );
    case "select":
      return (
        <Select value={String(value)} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {optionsOf(field).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {tr(o.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "text":
      return (
        <Input
          id={id}
          type="text"
          value={String(value)}
          placeholder={field.placeholder ? tr(field.placeholder) : undefined}
          maxLength={field.maxLength}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "secret":
      return <SecretControl field={field} id={id} />;
    case "number":
      return (
        <NumberInput field={field} id={id} value={value} onChange={onChange} />
      );
    case "path":
      return (
        <PathInput field={field} id={id} value={value} onChange={onChange} />
      );
  }
}

function NumberInput({ field, id, value, onChange }: CtlProps<NumberField>) {
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      value={draft}
      min={field.min}
      max={field.max}
      step={field.step}
      aria-invalid={invalid}
      onChange={(e) => {
        setDraft(e.target.value);
        const r = validatorOf(field).safeParse(
          e.target.value.trim() === "" ? NaN : Number(e.target.value),
        );
        setInvalid(!r.success);
        if (r.success) onChange(r.data);
      }}
    />
  );
}

function PathInput({ field, id, value, onChange }: CtlProps<PathField>) {
  const tr = useTr();

  async function pick() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const res = await open({
      directory: field.directory ?? false,
      multiple: false,
    });
    if (typeof res === "string") onChange(res);
  }
  return (
    <div className="flex w-full gap-2">
      <Input
        id={id}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
      {isTauri && (
        <Button type="button" variant="outline" onClick={pick}>
          {tr("settings.choose")}
        </Button>
      )}
    </div>
  );
}
