import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { TitleBar } from "@/core/shell/TitleBar";
import { useSetting } from "@/core/settings/SettingsProvider";
import { useSystemIntegration } from "@/core/shell/useSystemIntegration";
import { useLanguage } from "@/core/i18n";
import { useTheme } from "@/core/theme";

function RootLayout() {
  useSystemIntegration();
  useTheme(useSetting<string>("theme"));
  useLanguage(useSetting<string>("language"));

  return (
    <div className="app-shell app-backdrop text-foreground">
      <TitleBar title="app-base" />

      <div className="flex-1 app-scrollbar">
        <Outlet />
        <TanStackRouterDevtools />
      </div>
    </div>
  );
}

export const Route = createRootRoute({ component: RootLayout });
