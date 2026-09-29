import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const statePath = resolve(".wrangler/state");
rmSync(statePath, { recursive: true, force: true });

const wrangler = resolve(
  "node_modules",
  ".bin",
  process.platform === "win32" ? "wrangler.cmd" : "wrangler",
);

function runWrangler(args, input = undefined) {
  const result = spawnSync(wrangler, args, {
    cwd: process.cwd(),
    env: process.env,
    input,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

runWrangler(["d1", "migrations", "apply", "DB", "--local"], "y\n");
runWrangler([
  "d1",
  "execute",
  "DB",
  "--local",
  "--file",
  "tests/e2e/seed.sql",
  "--yes",
]);

console.log("Estado E2E local preparado.");
