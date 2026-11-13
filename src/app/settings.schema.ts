import {
  BrainCircuit,
  Database,
  Monitor,
  SlidersHorizontal,
} from "lucide-react";

import { defineSettings, type SettingsSchema } from "@/core/settings/types";

/**
 * ÚNICO arquivo de settings que muda de app pra app.
 * label/description/title são CHAVES de tradução (src/locales/*.json).
 * Texto cru também funciona (vira ele mesmo se a chave não existir).
 */
export const settingsSchema: SettingsSchema = defineSettings({
  version: 2,
  sections: [
    {
      id: "general",
      title: "settings.sections.general",
      icon: SlidersHorizontal,
      fields: [
        {
          key: "theme",
          type: "select",
          label: "settings.theme.label",
          default: "system",
          options: [
            { value: "system", label: "settings.theme.system" },
            { value: "light", label: "settings.theme.light" },
            { value: "dark", label: "settings.theme.dark" },
          ],
        },
        {
          key: "language",
          type: "select",
          label: "settings.language.label",
          default: "system",
          options: [
            { value: "system", label: "settings.language.system" },
            { value: "pt-BR", label: "Português (Brasil)" },
            { value: "en", label: "English" },
          ],
        },
      ],
    },
    {
      id: "system",
      title: "settings.sections.system",
      icon: Monitor,
      fields: [
        {
          key: "autostart",
          type: "toggle",
          label: "settings.autostart.label",
          default: false,
          platforms: ["desktop"],
        },
        {
          key: "minimizeToTray",
          type: "toggle",
          label: "settings.minimizeToTray.label",
          default: true,
          description: "settings.minimizeToTray.description",
          platforms: ["desktop"],
        },
      ],
    },
    {
      id: "brain",
      title: "settings.sections.brain",
      icon: BrainCircuit,
      fields: [
        {
          key: "openaikey",
          type: "secret",
          provider: "openai",
          label: "settings.openaikey.label",
          description: "settings.secret.description",
        },
        {
          key: "anthropickey",
          type: "secret",
          provider: "anthropic",
          label: "settings.anthropickey.label",
          description: "settings.secret.description",
        },
      ],
    },
    {
      id: "data",
      title: "settings.sections.data",
      icon: Database,
      fields: [
        {
          key: "dataDir",
          type: "path",
          label: "settings.dataDir.label",
          default: "",
          directory: true,
          platforms: ["desktop"],
        },
        {
          key: "maxItems",
          type: "number",
          label: "settings.maxItems.label",
          default: 100,
          min: 1,
          max: 10000,
        },
        {
          key: "logLevel",
          type: "select",
          label: "settings.logLevel.label",
          default: "info",
          options: ["error", "warn", "info", "debug"],
        },
      ],
    },
  ],
});

export type SectionId = (typeof settingsSchema.sections)[number]["id"];
export type SettingKey =
  (typeof settingsSchema.sections)[number]["fields"][number]["key"];
