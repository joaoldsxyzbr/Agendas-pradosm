import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../src/styles.css", import.meta.url),
  "utf8",
);

describe("design system", () => {
  it("define a identidade azul e amarela por tokens semânticos", () => {
    expect(css).toContain("--color-primary: #1558a6");
    expect(css).toContain("--color-primary-strong: #0b3d78");
    expect(css).toContain("--color-accent: #f4c430");
    expect(css).toContain("--color-background:");
    expect(css).toContain("--color-surface:");
    expect(css).toContain("--color-text:");
    expect(css).toContain("--color-border:");
    expect(css).toContain("var(--color-accent)");
  });

  it("remove o verde principal legado da identidade", () => {
    expect(css.toLowerCase()).not.toContain("#1f6848");
    expect(css).toContain("background: var(--color-primary)");
    expect(css).toContain("border-color: var(--color-primary)");
  });

  it("define o dark mode pela mesma camada de tokens", () => {
    expect(css).toContain('html[data-theme="dark"]');
    expect(css).toContain("--color-background: #0d1624");
    expect(css).toContain("--color-surface: #142033");
    expect(css).toContain("--color-primary: #5ca8ff");
    expect(css).toContain("--color-accent: #ffd449");
  });
});
