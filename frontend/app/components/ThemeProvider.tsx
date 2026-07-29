"use client";

import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline <script> in layout.tsx already set data-theme on <html>
  // before this component mounts -- read it back rather than defaulting to
  // "light", so there's no mismatch/flash between server and client.
  const [theme, setTheme] = useState<Theme>("light");

  // Syncs React state from the DOM attribute the inline theme-script
  // already set before hydration. A lazy useState initializer would read
  // `document` during SSR (unavailable) vs. the client's first pass
  // (available), producing a real hydration mismatch instead of this safe
  // post-hydration update.
  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme("dark");
    }
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      window.localStorage.setItem("studia-theme", next);
      return next;
    });
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
