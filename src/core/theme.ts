import { useEffect } from "react";

/** theme: "system" | "light" | "dark". Aplica a classe `dark` que o shadcn espera. */
export function useTheme(theme: string) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      root.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches));
    apply();
    if (theme !== "system") return;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);
}
