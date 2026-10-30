import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Worker local separado em 8787. O proxy so ajusta o Origin quando o
// navegador ja usou a origem local conhecida, preservando o CSRF no Worker.
// Nao ha proxy remoto ou bypass de validacao no ambiente publicado.
const viteOrigin = "http://127.0.0.1:5173";
const workerOrigin = "http://127.0.0.1:8787";

export default defineConfig({
  // A versão publicada na Preview usa prefixo isolado, sem substituir a UI operacional.
  base: process.env.MODERN_PREVIEW === "1" ? "/modern/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: workerOrigin,
        changeOrigin: true,
        ws: true,
        configure(proxy) {
          proxy.on("proxyReq", (request, incoming) => {
            if (incoming.headers.origin === viteOrigin) {
              request.setHeader("origin", workerOrigin);
            }
          });
          proxy.on("proxyReqWs", (request, incoming) => {
            if (incoming.headers.origin === viteOrigin) {
              request.setHeader("origin", workerOrigin);
            }
          });
        },
      },
    },
  },
  build: { outDir: "../../dist-modern", emptyOutDir: true, sourcemap: false },
});
