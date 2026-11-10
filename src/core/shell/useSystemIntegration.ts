import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { defaultWindowIcon } from "@tauri-apps/api/app";
import { Menu } from "@tauri-apps/api/menu";
import { TrayIcon } from "@tauri-apps/api/tray";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri, platformKind } from "../platform";
import { useSetting } from "../settings/SettingsProvider";

const desktop = isTauri && platformKind === "desktop";

/** Liga as settings `autostart` e `minimizeToTray` (se existirem no schema). */
export function useSystemIntegration() {
  const { t, i18n } = useTranslation();
  const autostart = useSetting<boolean | undefined>("autostart");
  const toTray = useSetting<boolean | undefined>("minimizeToTray");

  // Abrir ao iniciar o sistema
  useEffect(() => {
    if (!desktop || autostart === undefined || import.meta.env.DEV) return;
    (async () => {
      const { enable, disable, isEnabled } =
        await import("@tauri-apps/plugin-autostart");
      const on = await isEnabled();
      if (autostart && !on) await enable();
      if (!autostart && on) await disable();
    })().catch(console.error);
  }, [autostart]);

  // Bandeja: ícone + fechar a janela só esconde
  useEffect(() => {
    if (!desktop || !toTray) return;
    const win = getCurrentWindow();
    let tray: TrayIcon | undefined;
    let off: (() => void) | undefined;
    let stop = false;
    const show = async () => {
      await win.show();
      await win.unminimize();
      await win.setFocus();
    };

    (async () => {
      const menu = await Menu.new({
        items: [
          { id: "show", text: t("tray.show"), action: () => void show() },
          {
            id: "quit",
            text: t("tray.quit"),
            action: () => void win.destroy(),
          },
        ],
      });
      const created = await TrayIcon.new({
        icon: (await defaultWindowIcon()) ?? undefined,
        menu,
        showMenuOnLeftClick: false,
        action: (ev) => {
          if (
            ev.type === "Click" &&
            ev.button === "Left" &&
            ev.buttonState === "Up"
          )
            void show();
        },
      });
      // só intercepta o fechar DEPOIS que o tray existe (senão a janela some sem volta)
      const un = await win.onCloseRequested((e) => {
        e.preventDefault();
        void win.hide();
      });
      if (stop) {
        un();
        await created.close();
        return;
      }
      tray = created;
      off = un;
    })().catch(console.error);

    return () => {
      stop = true;
      off?.();
      void tray?.close();
    };
  }, [toTray, i18n.language]);
}
