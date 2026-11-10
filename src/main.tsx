import ReactDOM from "react-dom/client";
import "./core/i18n";
import "./index.css";
import { StrictMode } from "react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { settingsSchema } from "@/app/settings.schema";
import { SettingsProvider } from "@/core/settings/SettingsProvider";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    titleKey?: string;
  }
}

// Render the app
const rootElement = document.getElementById("root")!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <SettingsProvider schema={settingsSchema}>
        <RouterProvider router={router} />
      </SettingsProvider>
    </StrictMode>,
  );
}
