import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { openKV, type KV } from "../platform";
import { allFields, defaultsOf, migrate, sanitize } from "./engine";
import type { SettingsSchema, Values } from "./types";

interface Ctx {
  schema: SettingsSchema;
  values: Values;
  set: (key: string, value: unknown) => void;
  reset: (sectionId?: string) => void;
}

const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({
  schema,
  file = "settings.json",
  children,
}: {
  schema: SettingsSchema;
  file?: string;
  children: ReactNode;
}) {
  const [values, setValues] = useState<Values | null>(null);
  const valuesRef = useRef<Values>({});
  const kvRef = useRef<KV | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const kv = await openKV(file);
      kvRef.current = kv;
      const stored = (await kv.get("settings")) as Values | undefined;
      const raw = migrate(schema, stored);
      const clean = sanitize(schema, raw);

      valuesRef.current = clean;
      if (alive) setValues(clean);
      await kv.set("settings", { ...clean, __v: schema.version });
    })();
    return () => {
      alive = false;
    };
  }, [schema, file]);

  const commit = useCallback(
    (next: Values) => {
      valuesRef.current = next;
      setValues(next);
      void kvRef.current?.set("settings", { ...next, __v: schema.version });
    },
    [schema.version],
  );

  const set = useCallback(
    (key: string, value: unknown) => {
      if (
        allFields(schema).some(
          (field) => field.key === key && field.type === "secret",
        )
      ) {
        throw new Error("Secret fields must use the secure credential store");
      }
      commit({ ...valuesRef.current, [key]: value });
    },
    [commit, schema],
  );
  const reset = useCallback(
    (sectionId?: string) => {
      if (sectionId === undefined) {
        commit(defaultsOf(schema));
        return;
      }
      commit({ ...valuesRef.current, ...defaultsOf(schema, sectionId) });
    },
    [commit, schema],
  );

  if (!values) return null; // carregando (é local, dura milissegundos)
  return (
    <SettingsCtx.Provider
      value={{
        schema,
        values,
        set,
        reset,
      }}
    >
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings(): Ctx {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("useSettings fora do <SettingsProvider>");
  return c;
}

export function useSetting<T>(key: string): T {
  return useSettings().values[key] as T;
}
