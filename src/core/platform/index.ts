import type { PlatformKind } from "../settings/types";

const ua = navigator.userAgent;
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const platformKind: PlatformKind = /android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
export const isMac = platformKind === "desktop" && /Mac/i.test(ua);

export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

/** Tauri: arquivo via plugin-store. Browser (npm run dev): localStorage. */
export async function openKV(file: string): Promise<KV> {
  if (isTauri) {
    const { load } = await import("@tauri-apps/plugin-store");
    const store = await load(file, { autoSave: true } as Parameters<typeof load>[1]);
    return {
      get: (k) => store.get(k),
      set: async (k, v) => {
        await store.set(k, v);
      },
    };
  }
  return {
    get: async (k) => {
      try {
        const raw = localStorage.getItem(`${file}:${k}`);
        return raw ? JSON.parse(raw) : undefined;
      } catch {
        return undefined;
      }
    },
    set: async (k, v) => {
      try {
        localStorage.setItem(`${file}:${k}`, JSON.stringify(v));
      } catch {
        /* storage cheio ou bloqueado: segue sem persistir */
      }
    },
  };
}
