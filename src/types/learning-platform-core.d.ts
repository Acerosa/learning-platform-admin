declare module "@learning-platform/core" {
  export type ThemePreference = "light" | "dark" | "system";

  export interface ThemeSnapshot {
    preference: ThemePreference;
    resolvedTheme: "light" | "dark";
  }

  export interface ThemeService {
    getPreference(): ThemePreference;
    getResolvedTheme(): "light" | "dark";
    setPreference(mode: ThemePreference): ThemeSnapshot;
    subscribe(listener: (state: ThemeSnapshot) => void): () => void;
    destroy(): void;
  }

  export function createThemeService(): ThemeService;
  export function applyBranding(
    root: HTMLElement,
    branding: { primary?: string; accent?: string },
  ): void;
}
