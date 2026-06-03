import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Lang = "ru" | "en" | "zh";

type Dict = Record<string, string>;

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem("duster_lang") as Lang) || "ru"
  );
  const [dict, setDict] = useState<Dict>({});

  useEffect(() => {
    fetch(`/api/i18n/${lang}`)
      .then((r) => r.json())
      .then(setDict)
      .catch(() => setDict({}));
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem("duster_lang", l);
    setLangState(l);
  }, []);

  const t = useCallback((key: string) => dict[key] ?? key, [dict]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>
  );
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n");
  return ctx;
}
