import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("login carrega com CSP válida, tema antecipado e sem violações graves", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("theme", "dark");
  });

  const response = await page.goto("/login");
  expect(response).not.toBeNull();

  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'");
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await expect(page.getByLabel("Login")).toBeVisible();
  await expect(page.getByLabel("Senha")).toBeVisible();

  const scan = await new AxeBuilder({ page }).analyze();
  const blocking = scan.violations.filter(
    (violation) =>
      violation.impact === "critical" || violation.impact === "serious",
  );

  expect(blocking).toEqual([]);
});
