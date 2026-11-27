import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "tx-theme";

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** The theme index.html set before the first paint, and a toggle that remembers it. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(current);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const toggle = useCallback(() => {
    setTheme((previous) => {
      const next = previous === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Storage can be off; the theme then lasts for the visit.
      }
      return next;
    });
  }, []);
  return [theme, toggle];
}
