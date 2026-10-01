import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "../../src/theme/theme";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

describe("theme", () => {
  it("inicia sempre em dark", () => {
    render(
      <ThemeProvider>
        <div>Conteúdo</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("ignora preferência light salva anteriormente", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    render(
      <ThemeProvider>
        <div>Conteúdo</div>
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
