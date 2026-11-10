import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "@/core/settings/ui/SettingsPage";

export const Route = createFileRoute("/settings")({
  staticData: { titleKey: "nav.settings" },
  validateSearch: (s: Record<string, unknown>): { section?: string } => ({
    section: typeof s.section === "string" ? s.section : undefined,
  }),
  component: SettingsRoute,
});

function SettingsRoute() {
  const { section } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <SettingsPage
      section={section}
      onSelectSection={(id) =>
        navigate({ search: { section: id }, replace: true })
      }
    />
  );
}
