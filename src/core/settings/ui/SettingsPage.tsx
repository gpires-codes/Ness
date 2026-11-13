import { ArrowLeft } from "lucide-react";

import { Link } from "@tanstack/react-router";
import { useTr } from "@/core/i18n";
import { useSettings } from "@/core/settings/SettingsProvider";
import { useVisibleSections } from "@/core/settings/useVisibleSections";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

import { Row } from "./Row";

export function SettingsPage({
  section,
  onSelectSection,
}: {
  section?: string;
  onSelectSection: (id: string) => void;
}) {
  const tr = useTr();
  const { reset, schema, values } = useSettings();
  const sections = useVisibleSections();
  const current = sections.find((s) => s.id === section) ?? sections[0];
  if (!current) return null;
  const sectionDefaults = schema.sections.find((s) => s.id === current.id);
  const hasChanges =
    sectionDefaults?.fields.some(
      (field) =>
        field.type !== "secret" &&
        !Object.is(values[field.key], field.default),
    ) ?? false;

  return (
    <SidebarProvider className="h-full min-h-0">
      <SettingsSideBar
        collapsible="none"
        className="m-2 h-[calc(100%-1rem)] rounded-xl border"
        sections={sections}
        selectedSection={current.id}
        onSelectSection={onSelectSection}
      />

      <main className="app-scrollbar min-w-0 flex-1 px-5 py-6">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-3 text-base font-semibold">{tr(current.title)}</h1>
          <div className="divide-y border-b">
            {current.fields.map((f) => (
              <Row key={f.key} field={f} />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-8"
            disabled={!hasChanges}
            onClick={() => reset(current.id)}
          >
            {tr("settings.reset")}
          </Button>
        </div>
      </main>
    </SidebarProvider>
  );
}

interface SettingsSideBarProps extends React.ComponentProps<typeof Sidebar> {
  sections: ReturnType<typeof useVisibleSections>;
  selectedSection: string;
  onSelectSection: (id: string) => void;
}

function SettingsSideBar({
  sections,
  selectedSection,
  onSelectSection,
  ...props
}: SettingsSideBarProps) {
  const tr = useTr();

  return (
    <Sidebar {...props}>
      <SidebarHeader className="flex flex-row items-center">
        <Button variant="ghost" size="icon" render={<Link to="/" />}>
          <ArrowLeft />
        </Button>
        {tr("settings.title")}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {sections.map((sec) => {
                const Icon = sec.icon;
                return (
                  <SidebarMenuItem key={sec.id}>
                    <SidebarMenuButton
                      isActive={sec.id === selectedSection}
                      onClick={() => onSelectSection(sec.id)}
                    >
                      {Icon && <Icon />}
                      <span>{tr(sec.title)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
