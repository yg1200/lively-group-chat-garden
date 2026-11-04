import { useCallback, useEffect, useState } from "react";

const KEY = "gc.theme";
export type Theme = "light" | "dark";

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  try {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** Light/dark toggle. Until the user picks one, the system preference applies (see styles.css). */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => setTheme(stored() ?? system()), []);
  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable: the choice just lasts for this visit */
    }
  }, [theme]);
  return { theme, toggle };
}
