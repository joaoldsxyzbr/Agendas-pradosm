import { verifyPassword } from "../worker/lib/password.js";

// Isolado do Worker de negocio. Executado SOMENTE com wrangler dev --local
// e --ip 127.0.0.1. Nenhuma rota de benchmark e publicada na producao.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method !== "POST" || url.pathname !== "/verify") {
      return new Response(null, { status: 404 });
    }
    const body = await request.json().catch(() => null);
    if (!body || typeof body.password !== "string" || typeof body.encoded !== "string") {
      return Response.json({ error: "Invalid synthetic fixture" }, { status: 400 });
    }
    const valid = await verifyPassword(body.password, body.encoded);
    return Response.json({ valid }, { headers: { "Cache-Control": "no-store" } });
  }
};
