import { apiFetch } from "./api.js";
import { createVanillaRuntime } from "./runtime.js";
import { createMigratedPageRenderers } from "./pages.js";
import { createRealtimeClient } from "./realtime.js";
import { createStorePresence } from "./presence.js";

// Montagem isolada do frontend migrado. Não ligada ao index.html da main.
export function createMigratedApplication({
  root, request = apiFetch, win = window, doc = document
} = {}) {
  if (!root) throw Error("A aplicação precisa de um elemento raiz.");
  const realtime = createRealtimeClient({
    request, Socket: win.WebSocket, location: win.location, timers: win
  });
  const presence = createStorePresence({ request, realtime, win, doc });
  let currentSession = null;

  const onSessionChange = ({ user, loading }) => {
    if (loading) return;
    const identity = user ? `${user.id}:${user.papel}` : null;
    if (currentSession === identity) return;
    presence.stop();
    realtime.stop();
    currentSession = identity;
    if (!user) return;
    void realtime.start(user.id);
    if (user.papel === "conferente") presence.start();
  };
  const runtime = createVanillaRuntime({
    root, request, win, doc,
    pageRenderers: createMigratedPageRenderers({ realtime }),
    beforeLogout: () => presence.disconnect(),
    onSessionChange
  });
  return {
    async start() { await runtime.start(); },
    navigate: runtime.navigate,
    get user() { return runtime.auth.user; },
    get realtimeState() { return realtime.state; },
    stop() {
      runtime.stop();
      presence.stop();
      realtime.stop();
      currentSession = null;
    }
  };
}
