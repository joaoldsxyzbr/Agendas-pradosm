import { test as base, expect } from "@playwright/test";

// O E2E roda com várias sessões no mesmo Wrangler local e o limite por IP é
// compartilhado. Cada cenário simula um cliente diferente sem desativar ou
// aumentar o rate limit real de autenticação.
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const identity = `${testInfo.file}:${testInfo.title}`;
    let hash = 2166136261;
    for (const character of identity) {
      hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    }
    await page.setExtraHTTPHeaders({
      "CF-Connecting-IP": `198.51.100.${1 + (hash % 250)}`
    });
    await use(page);
  }
});
export { expect };
