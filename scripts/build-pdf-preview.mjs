import { buildSync } from "esbuild";
import { mkdirSync } from "node:fs";

// Empacotamento mínimo da biblioteca WASM, sem React e sem código inline.
mkdirSync("public/vanilla", { recursive: true });
buildSync({
  entryPoints: ["src/import/extractPdfText.js"],
  outfile: "public/vanilla/extractPdfText.js",
  platform: "browser",
  format: "esm",
  target: "es2022",
  bundle: true,
  loader: { ".wasm": "file" },
  assetNames: "[name]-[hash]",
});
console.log("Extrator PDF nativo preparado para publicação na preview.");
