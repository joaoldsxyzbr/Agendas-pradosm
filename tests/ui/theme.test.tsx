import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { ThemeToggle } from "../../src/theme/ThemeToggle";
import { THEME_STORAGE_KEY } from "../../src/theme/theme";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

describe("theme", () => {
  it("inicia em dark e alterna para light sem recarregar", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");

    fireEvent.click(
      screen.getByRole("button", { name: "Ativar modo claro" }),
    );

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(
      screen.getByRole("button", { name: "Ativar modo escuro" }),
    ).toBeInTheDocument();
  });

  it("restaura light salvo", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(
      screen.getByRole("button", { name: "Ativar modo escuro" }),
    ).toBeInTheDocument();
  });

  it("valor inválido volta para dark", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
