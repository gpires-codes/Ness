import { Copy, Minus, Settings, Square, UserCircle2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Link } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";

import { isMac, isTauri, platformKind } from "@/core/platform";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { useMatches } from "@tanstack/react-router";

function WinButton({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-full w-11 items-center justify-center transition-colors hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar({ title }: { title?: string }) {
  const { t } = useTranslation();
  const titleKey = useMatches({
    select: (matches) => matches.at(-1)?.staticData?.titleKey,
  });
  const [maximized, setMaximized] = useState(false);
  const enabled = isTauri && platformKind === "desktop";

  useEffect(() => {
    if (!enabled) return;
    const win = getCurrentWindow();
    const sync = () => void win.isMaximized().then(setMaximized);
    sync();
    const unlisten = win.onResized(sync);
    return () => {
      void unlisten.then((off) => off());
    };
  }, [enabled]);

  if (!enabled) return null;
  const win = getCurrentWindow();

  return (
    <header
      data-tauri-drag-region
      className="glass flex h-7 shrink-0 select-none items-center border-b text-sm text-muted-foreground [--glass-blur:32px] [--glass-opacity:40%]"
    >
      {/* Title */}
      <span
        data-tauri-drag-region
        className={cn("flex-1 truncate px-3", isMac && "pl-20")}
      >
        {title}
        {(title && titleKey) && ` • ${t(titleKey)}`}
      </span>

      {/* Actions */}
      <div className="mr-1 flex h-full items-center gap-0.5">
        <Button
          disabled
          variant="ghost"
          size="icon-sm"
          className="size-6 [&.active]:bg-accent/50"
        >
          <UserCircle2 />
        </Button>

        <Button
          variant="ghost"
          size="icon-sm"
          className="size-6 [&.active]:bg-accent/50"
          render={<Link to="/settings" />}
        >
          <Settings />
        </Button>
      </div>

      {/* Win buttons in windows SO */}
      {!isMac && (
        <div className="flex h-full">
          <WinButton
            label={t("window.minimize")}
            onClick={() => void win.minimize()}
          >
            <Minus className="size-4" />
          </WinButton>
          <WinButton
            label={t(maximized ? "window.restore" : "window.maximize")}
            onClick={() => void win.toggleMaximize()}
          >
            {maximized ? (
              <Copy className="size-3.5" />
            ) : (
              <Square className="size-3.5" />
            )}
          </WinButton>
          <WinButton
            label={t("window.close")}
            onClick={() => void win.close()}
            className="hover:bg-destructive hover:text-white"
          >
            <X className="size-4" />
          </WinButton>
        </div>
      )}
    </header>
  );
}
