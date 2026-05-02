"use client";

// Light/dark theme toggle. The actual class on <html> is set by an inline
// script in app/layout.tsx before hydration so there's no flash. This button
// just flips the class + persists the choice.

import { useEffect, useState } from "react";

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Přepnout na světlý motiv" : "Přepnout na tmavý motiv"}
      title={isDark ? "Světlý motiv" : "Tmavý motiv"}
      className="px-2 py-1 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-900 transition-colors"
    >
      <span aria-hidden className="text-base leading-none">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
