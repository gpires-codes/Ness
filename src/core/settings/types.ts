import { LucideIcon } from "lucide-react";

export type PlatformKind = "desktop" | "mobile";
export type Values = Record<string, unknown>;
export type Option = { value: string; label: string };

interface FieldBase {
  key: string;
  label: string;
  description?: string;
  /** Onde o campo aparece. Omitido = todas as plataformas. */
  platforms?: PlatformKind[];
  /** Esconde o campo dependendo de outros valores. */
  visibleIf?: (values: Values) => boolean;
}

export type ToggleField = FieldBase & { type: "toggle"; default: boolean };
export type TextField = FieldBase & {
  type: "text";
  default: string;
  placeholder?: string;
  maxLength?: number;
};
export type SecretProvider = "openai" | "anthropic";
export type SecretField = FieldBase & {
  type: "secret";
  provider: SecretProvider;
};
export type NumberField = FieldBase & {
  type: "number";
  default: number;
  min?: number;
  max?: number;
  step?: number;
};
export type SelectField = FieldBase & {
  type: "select";
  default: string;
  options: (string | Option)[];
};
export type PathField = FieldBase & {
  type: "path";
  default: string;
  directory?: boolean;
};

export type Field =
  | ToggleField
  | TextField
  | SecretField
  | NumberField
  | SelectField
  | PathField;
export type PersistentField = Exclude<Field, SecretField>;

export interface Section {
  id: string;
  title: string;
  icon?: LucideIcon;
  fields: readonly Field[];
}

export interface SettingsSchema {
  /** Sobe 1 sempre que mudar o formato das configs salvas. */
  version: number;
  sections: Section[];
  /** migrations[2] converte as configs da v1 para a v2, e assim por diante. */
  migrations?: Record<number, (old: Values) => Values>;
}

export function defineSettings<const T extends SettingsSchema>(schema: T): T {
  return schema;
}
