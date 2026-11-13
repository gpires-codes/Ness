import { z } from "zod";
import type {
  Field,
  Option,
  PersistentField,
  SelectField,
  SettingsSchema,
  Values,
} from "./types";

export const allFields = (s: SettingsSchema): Field[] =>
  s.sections.flatMap((sec) => sec.fields);

export const optionsOf = (f: SelectField): Option[] =>
  f.options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));

export function validatorOf(f: PersistentField): z.ZodTypeAny {
  switch (f.type) {
    case "toggle":
      return z.boolean();
    case "number": {
      let n = z.number().finite();
      if (f.min !== undefined) n = n.min(f.min);
      if (f.max !== undefined) n = n.max(f.max);
      return n;
    }
    case "select":
      return z.enum(optionsOf(f).map((o) => o.value) as [string, ...string[]]);
    case "text": {
      let t = z.string();
      if (f.maxLength) t = t.max(f.maxLength);
      return t;
    }
    case "path":
      return z.string();
  }
}

export function defaultsOf(schema: SettingsSchema, sectionId?: string): Values {
  const sections =
    sectionId === undefined
      ? schema.sections
      : schema.sections.filter((section) => section.id === sectionId);
  return Object.fromEntries(
    sections.flatMap((section) =>
      section.fields
        .filter((field) => field.type !== "secret")
        .map((field) => [field.key, field.default]),
    ),
  );
}

/** Config corrompida? Só o campo ruim volta pro default, o resto fica. */
export function sanitize(schema: SettingsSchema, raw: Values): Values {
  const out = defaultsOf(schema);
  for (const f of allFields(schema)) {
    if (f.type === "secret") continue;
    if (!(f.key in raw)) continue;
    const r = validatorOf(f).safeParse(raw[f.key]);
    if (r.success) out[f.key] = r.data;
  }
  return out;
}

export function migrate(
  schema: SettingsSchema,
  raw: Values | null | undefined,
): Values {
  if (!raw) return {};
  const { __v, ...rest } = raw as Values & { __v?: number };
  let data: Values = rest;
  let v = typeof __v === "number" ? __v : 1;
  while (v < schema.version) {
    v++;
    data = schema.migrations?.[v]?.(data) ?? data;
  }
  return data;
}
