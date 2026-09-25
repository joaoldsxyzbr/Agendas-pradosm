import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      className="theme-toggle ghost-button"
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? "Ativar modo claro" : "Ativar modo escuro"}
    >
      <span aria-hidden="true">{dark ? "☀" : "☾"}</span>
      <span>{dark ? "Tema claro" : "Tema escuro"}</span>
    </button>
  );
}
