"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyBranding,
  createThemeService,
  type ThemePreference,
  type ThemeService,
} from "@learning-platform/core";

let sharedTheme: ThemeService | null = null;

function getThemeService() {
  sharedTheme ??= createThemeService();
  return sharedTheme;
}

export function usePlatformTheme() {
  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    "light",
  );

  useEffect(() => {
    const service = getThemeService();
    applyBranding(document.documentElement, {
      primary: "#136f70",
      accent: "#0f9f8f",
    });

    return service.subscribe((state) => {
      setPreferenceState(state.preference);
      setResolvedTheme(state.resolvedTheme);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const service = getThemeService();
    service.setPreference(service.getResolvedTheme() === "dark" ? "light" : "dark");
  }, []);

  return { preference, resolvedTheme, toggleTheme };
}
