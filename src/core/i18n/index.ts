import { useEffect } from "react";
import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import ptBR from "../../locales/pt-BR.json";
import en from "../../locales/en.json";

export const systemLanguage = () => {
  const l = navigator.language.toLowerCase();
  if (l.startsWith("pt")) return "pt-BR";
  return "en";
};

void i18n.use(initReactI18next).init({
  resources: {
    "pt-BR": { translation: ptBR },
    en: { translation: en },
  },
  lng: systemLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

/** Liga a config "language" ("system" | "pt-BR" | "en") ao i18next. */
export function useLanguage(pref: string) {
  useEffect(() => {
    void i18n.changeLanguage(pref === "system" ? systemLanguage() : pref);
  }, [pref]);
}

/** Traduz chave; se não existir, devolve o próprio texto (aceita string crua no schema). */
export function useTr() {
  const { t } = useTranslation();
  return (key: string) => t(key, { defaultValue: key }) as string;
}

export default i18n;
