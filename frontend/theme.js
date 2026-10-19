// Equivalente à escolha de tema atual da main.
export const THEME_STORAGE_KEY = "agenda-prado-theme";
export function readStoredTheme() {
  return "dark";
}
export function applyTheme(theme, doc = document) {
  doc.documentElement.dataset.theme = theme;
  doc.documentElement.style.colorScheme = theme;
}
export function createThemeController({ doc = document, storage = localStorage } = {}) {
  let theme = readStoredTheme();
  const update = () => {
    applyTheme(theme, doc);
    try { storage.setItem(THEME_STORAGE_KEY, theme); } catch {}
    return theme;
  };
  return {
    get theme() { return theme; },
    apply: update,
    toggle() { theme = theme === "light" ? "dark" : "light"; return update(); }
  };
}