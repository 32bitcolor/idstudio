"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "nord", label: "Nord" },
  { id: "dracula", label: "Dracula" },
  { id: "solarized", label: "Solarized Light" },
] as const;

const STORAGE_KEY = "idstudio-theme";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>("system");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTheme(localStorage.getItem(STORAGE_KEY) ?? "system");
  }, []);

  function apply(id: string) {
    setTheme(id);
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore (private mode / disabled storage)
    }
    if (id === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", id);
  }

  const current = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground/70 hover:bg-hover"
      >
        Theme: {current.label}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-border bg-surface py-1 shadow-lg">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => apply(t.id)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-hover"
              >
                <span>{t.label}</span>
                {theme === t.id && <span className="text-foreground/70">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
