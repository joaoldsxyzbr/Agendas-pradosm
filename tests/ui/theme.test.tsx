import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import css from "../../src/styles.css?raw";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { ThemeToggle } from "../../src/theme/ThemeToggle";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.documentElement.style.colorScheme = "";
});

describe("theme", () => {
  it("alterna para dark sem recarregar e persiste", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ativar modo escuro" }),
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Ativar modo claro" }),
    ).toBeInTheDocument();
  });

  it("restaura dark salvo", () => {
    localStorage.setItem("theme", "dark");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Ativar modo claro" }),
    ).toBeInTheDocument();
  });

  it("define tokens escuros sem duplicar a folha inteira", () => {
    expect(css).toContain('html[data-theme="dark"]');
    expect(css).toContain("--color-background: #0d1624");
    expect(css).toContain("--color-surface: #142033");
    expect(css).toContain("--color-primary: #5ca8ff");
    expect(css).toContain("--color-accent: #ffd449");
  });
});
