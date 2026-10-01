export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "agenda-prado-theme";

export function readStoredTheme(): Theme {
  return "dark";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}
