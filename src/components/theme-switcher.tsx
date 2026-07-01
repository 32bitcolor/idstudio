"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEMES = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "nord", label: "Nord" },
  { id: "dracula", label: "Dracula" },
  { id: "solarized", label: "Solarized Light" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "catppuccin-mocha", label: "Catppuccin Mocha" },
  { id: "catppuccin-latte", label: "Catppuccin Latte" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "monokai", label: "Monokai" },
  { id: "synthwave", label: "Synthwave" },
] as const;

const STORAGE_KEY = "idstudio-theme";

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<string>("system");

  useEffect(() => {
    setTheme(localStorage.getItem(STORAGE_KEY) ?? "system");
  }, []);

  function apply(id: string) {
    setTheme(id);
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Palette className="size-4" />
          <span className="hidden sm:inline">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme} onValueChange={apply}>
          {THEMES.map((t) => (
            <DropdownMenuRadioItem key={t.id} value={t.id}>
              {t.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
