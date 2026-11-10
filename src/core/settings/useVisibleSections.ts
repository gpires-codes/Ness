import { useMemo } from "react";

import { platformKind } from "@/core/platform";

import { useSettings } from "./SettingsProvider";

export function useVisibleSections() {
  const { schema, values } = useSettings();
  return useMemo(
    () =>
      schema.sections
        .map((sec) => ({
          ...sec,
          fields: sec.fields.filter(
            (f) =>
              (!f.platforms || f.platforms.includes(platformKind)) &&
              (!f.visibleIf || f.visibleIf(values)),
          ),
        }))
        .filter((sec) => sec.fields.length > 0),
    [schema, values],
  );
}
