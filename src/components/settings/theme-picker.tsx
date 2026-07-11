"use client";

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

// Kept in sync with the [data-theme] blocks in src/app/globals.css. Only the two
// swatch colors live here — everything else is driven by the CSS custom properties.
const THEMES = [
  { id: "system", label: "System", bg: null, accent: null },
  { id: "light", label: "Light", bg: "#ffffff", accent: "#171717" },
  { id: "dark", label: "Dark", bg: "#0a0a0a", accent: "#ededed" },
  { id: "github-light", label: "GitHub Light", bg: "#ffffff", accent: "#0969da" },
  { id: "solarized", label: "Solarized Light", bg: "#fdf6e3", accent: "#268bd2" },
  { id: "catppuccin-latte", label: "Catppuccin Latte", bg: "#eff1f5", accent: "#8839ef" },
  { id: "nord", label: "Nord", bg: "#2e3440", accent: "#88c0d0" },
  { id: "dracula", label: "Dracula", bg: "#282a36", accent: "#bd93f9" },
  { id: "tokyo-night", label: "Tokyo Night", bg: "#1a1b26", accent: "#7aa2f7" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", bg: "#1e1e2e", accent: "#cba6f7" },
  { id: "rose-pine", label: "Rosé Pine", bg: "#191724", accent: "#c4a7e7" },
  { id: "one-dark", label: "One Dark", bg: "#282c34", accent: "#61afef" },
  { id: "everforest", label: "Everforest", bg: "#2d353b", accent: "#a7c080" },
  { id: "kanagawa", label: "Kanagawa", bg: "#1f1f28", accent: "#7e9cd8" },
  { id: "ayu-mirage", label: "Ayu Mirage", bg: "#1f2430", accent: "#ffcc66" },
  { id: "gruvbox", label: "Gruvbox", bg: "#282828", accent: "#fe8019" },
  { id: "monokai", label: "Monokai", bg: "#272822", accent: "#f92672" },
  { id: "synthwave", label: "Synthwave", bg: "#241b35", accent: "#ff7edb" },
] as const;

const STORAGE_KEY = "idstudio-theme";
const THEME_EVENT = "idstudio-theme-change";

function subscribe(callback: () => void) {
  // "storage" syncs across tabs; the custom event syncs within this tab.
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "system";
  } catch {
    return "system";
  }
}

export function ThemePicker() {
  // Read the persisted theme without a setState-in-effect; the server snapshot
  // ("system") matches the pre-paint script's default until hydration.
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => "system");

  function apply(id: string) {
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // ignore (private mode / disabled storage)
    }
    if (id === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", id);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {THEMES.map((t) => {
        const active = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => apply(t.id)}
            aria-pressed={active}
            title={t.label}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
              active ? "border-accent bg-accent/8" : "border-border hover:border-border-strong hover:bg-hover"
            )}
          >
            <span
              className="relative flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong"
              style={{ background: t.bg ?? "linear-gradient(135deg, #fff 50%, #0a0a0a 50%)" }}
            >
              {t.accent && (
                <span className="absolute inset-0 m-auto size-2.5 rounded-full" style={{ background: t.accent }} />
              )}
            </span>
            <span className="min-w-0 flex-1 font-medium leading-tight">{t.label}</span>
            {active && <Check className="size-4 shrink-0 text-accent" />}
          </button>
        );
      })}
    </div>
  );
}
