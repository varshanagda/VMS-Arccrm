"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AppTheme = "light" | "dark";

const STORAGE_KEY = "vms_theme";

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDom(theme: AppTheme) {
  // Single source of truth for styling: `html[data-theme="..."]`
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children, defaultTheme = "dark" }: { children: ReactNode; defaultTheme?: AppTheme }) {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    if (typeof localStorage !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "light" || stored === "dark") return stored;
      } catch {
        // ignore
      }
    }
    if (typeof document !== "undefined") {
      const fromDom = document.documentElement.dataset.theme;
      if (fromDom === "light" || fromDom === "dark") return fromDom;
    }
    return defaultTheme;
  });

  useEffect(() => {
    let nextTheme: AppTheme = theme;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "light" || stored === "dark") {
        nextTheme = stored;
      }
    } catch {
      // ignore
    }
    setThemeState(nextTheme);
    applyThemeToDom(nextTheme);
  }, [defaultTheme, theme]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    applyThemeToDom(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
