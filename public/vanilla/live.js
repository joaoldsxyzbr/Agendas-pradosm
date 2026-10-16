import { showDashboard } from "./pages/recebimento.js";
import { showConferente } from "./pages/conferente.js";
import { showStores } from "./pages/lojas.js";
import { showUsers } from "./pages/usuarios.js";
import { showReports } from "./pages/relatorios.js";
import { createAgendaController } from "./features/agenda.js";
import { openImportDialog } from "./features/importacao.js";

(function nativeApp() {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const root = $("#main");
  const shell = $(".app-shell");
  const dateToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const state = { user: null, view: "recebimento", date: dateToday(), search: "", store: "", reportStore: "", agendas: [], stores: [], users: [], storeAgenda: null, detail: null, detailDialogClose: null, detailOpener: null, busy: false, edit: false };
  let navigationToken = 0;
  let realtimeSocket = null;
  let presenceTimer = null;
  let lastPresenceInteraction = 0;
  let realtimeTimer = null;
  let refreshScheduled = null;
  const sendPresence = () => {
    if (realtimeSocket?.readyState !== WebSocket.OPEN || state.user?.papel !== "conferente") return;
    realtimeSocket.send(JSON.stringify({ version: 1, type: "presence.set", status: document.hidden ? "away" : "online" }));
  };
  const closeRealtime = () => {
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = null;
    document.removeEventListener("visibilitychange", sendPresence);
    if (realtimeTimer) clearInterval(realtimeTimer);
    if (refreshScheduled) clearTimeout(refreshScheduled);
    realtimeTimer = null;
    refreshScheduled = null;
    realtimeSocket?.close(1000, "sessão encerrada");
    realtimeSocket = null;
  };
  const liveRefresh = () => {
    if (document.hidden || !state.user || state.busy || $("#dialog-host")?.children.length) return;
    if (state.view === "relatorios" && $("#report-form")?.dataset.dirty === "true") return;
    if (!["conferente", "recebimento", "relatorios"].includes(state.view)) return;
    clearTimeout(refreshScheduled);
    refreshScheduled = setTimeout(() => void navigate(), 450);
  };
  const connectRealtime = async () => {
    closeRealtime();
    if (!state.user) return;
    // Presença HTTP segue ativa mesmo com WebSocket desligado.
    if (state.user.papel === "conferente") {
      void touchPresence(true);
      presenceTimer = setInterval(() => void touchPresence(false), 60_000);
    }
    // Fallback apenas na preview; quando o ambiente habilitar WebSocket, usa eventos de imediato.
    realtimeTimer = setInterval(liveRefresh, 30000);
    const status = await api("/api/realtime/config").catch(() => ({ mode: "off" }));
    if (status.mode !== "on" || !state.user) return;
    const url = new URL("/api/realtime", location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    realtimeSocket = ws;
    ws.addEventListener("message", e => {
      let event;
      try { event = JSON.parse(e.data); } catch { if (e.data === "ping") ws.send("pong"); return; }
      if (event.version !== 1) return;
      if (event.type === "realtime.ready") sendPresence();
      if (event.type === "agenda.changed" || event.type === "presence.changed") liveRefresh();
    });
    ws.addEventListener("open", sendPresence);
    document.addEventListener("visibilitychange", sendPresence);
  };
  const touchPresence = async (interacted = false) => {
    if (state.user?.papel !== "conferente") return;
    await json("POST", "/api/store/presence", { interacted }).catch(() => {});
  };
  const resetScreenFilters = () => {
    state.date = dateToday();
    state.store = "";
    state.reportStore = "";
    state.reportStart = "";
    state.reportEnd = "";
    state.reportOffset = 0;
    state.reportCompare = true;
    state.detail = null;
    state.edit = false;
  };
  const pageTitles = { recebimento: "Recebimento", relatorios: "Relatórios gerenciais", conferente: "Conferente", lojas: "Lojas", usuarios: "Usuários" };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (n) => new Intl.NumberFormat("pt-BR").format(Number(n || 0));
  const dt = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : d || "—");
  const statusLabel = s => ({ aguardando: "Aguardando", recebido: "Recebido", nao_chegou: "Não recebido", recusado: "Recusado", aberto: "Em andamento", concluido: "Concluída", ativo: "Ativo", inativo: "Inativo" }[s] || s || "—");
  const badge = s => `<span class="status ${esc(s)}">${esc(statusLabel(s))}</span>`;
  const heading = (area, title, hint, actions = "") => `<div class="page-heading"><div><p class="eyebrow">${esc(area)}</p><h1>${esc(title)}</h1><p class="heading-note">${esc(hint)}</p></div><div class="page-actions">${actions}</div></div>`;
  const panel = (title, description, contents) => `<section class="card"><div class="card-header"><div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></div>${contents}</section>`;
  const stats = (values) => `<div class="stats">${values.map((x, i) => `<div class="stat" style="--stat-tone:${["var(--accent)", "var(--positive)", "var(--negative)", "var(--warning)"][i % 4]}"><span class="stat-label">${esc(x[0])}</span><strong class="stat-value">${esc(x[1])}</strong><small class="stat-foot">${esc(x[2])}</small></div>`).join("")}</div>`;
  const table = (headers, rows, empty = "Nenhum registro encontrado.") => `<div class="table-scroll"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("") || `<tr><td colspan="${headers.length}" class="empty">${esc(empty)}</td></tr>`}</tbody></table></div>`;
  const storeOpts = (selected = "", all = true) => `${all ? `<option value="">Todas as lojas</option>` : `<option value="">Selecione a loja</option>`}${state.stores.map(s => `<option value="${esc(s.codigo)}" ${selected === s.codigo ? "selected" : ""}>${esc(s.codigo)} · ${esc(s.nome)}</option>`).join("")}`;
  const api = async (url, options = {}) => {
    const res = await fetch(url, { credentials: "include", ...options });
    if (!res.ok) {
      let body;
      try { body = await res.json(); } catch { /* error without JSON */ }
      const err = new Error(body?.message || `Erro de comunicação (${res.status})`);
      err.status = res.status; err.code = body?.error;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  };
  const json = (method, url, body) => api(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const tell = (message, error = false) => {
    const host = $("#toast-host");
    host.textContent = message;
    host.className = error ? "toast toast-error" : "toast";
    host.setAttribute("role", error ? "alert" : "status");
  };
  const setBusy = (yes) => { state.busy = yes; [...$$("button[data-action]", root), ...$$("button", $("#dialog-host"))].forEach(b => { b.disabled = yes; }); };
  const asyncAction = async (job, msg = "") => {
    if (state.busy) return;
    try { setBusy(true); await job(); if (msg) tell(msg); }
    catch (e) { tell(e.message || "Não foi possível concluir.", true); }
    finally { setBusy(false); }
  };
  const modal = (title, body, submit, onSubmit) => {
    const rootHost = $("#dialog-host");
    const host = $(".agenda-dialog", rootHost) ? $("#agenda-form-host", rootHost) : rootHost;
    host.innerHTML = `<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${esc(title)}</h2><form id="modal-form">${body}<div class="dialog-actions"><button class="secondary" type="button" id="modal-cancel">Cancelar</button><button class="primary" type="submit">${esc(submit)}</button></div></form></section></div>`;
    const close = () => { host.replaceChildren(); document.removeEventListener("keydown", onKey); $(".agenda-dialog", rootHost)?.focus(); };
    const onKey = e => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    $("#modal-cancel").onclick = close;
    $(".dialog-backdrop", host).addEventListener("click", e => { if (e.target.classList.contains("dialog-backdrop")) close(); });
    $("#modal-form").onsubmit = e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.currentTarget));
      asyncAction(async () => { await onSubmit(data); close(); }, "");
    };
    $("input,select,textarea", host)?.focus();
    return { close, host };
  };
  const field = (label, name, value = "", required = true, kind = "text") => `<label class="field">${esc(label)}<input name="${esc(name)}" type="${esc(kind)}" value="${esc(value)}" ${required ? "required" : ""}></label>`;
  const makeLogin = async () => {
    const loginToken = ++navigationToken;
    resetScreenFilters();
    shell.classList.add("unauthenticated");
    $(".sidebar").hidden = true;
    $(".topbar").hidden = true;
    $(".footer").hidden = true;
    root.classList.add("auth-main");
    state.user = null;
    const d = await api("/api/auth/demo-status").catch(() => ({ available: false }));
    if (loginToken !== navigationToken) return;
    root.innerHTML = `<section class="auth-card"><span class="brand-mark" aria-hidden="true">P</span><p class="eyebrow">Agenda Prado · Ambiente de testes</p><h1>Entrar</h1><p class="heading-note">Acesse a operação com sua conta.</p>
      <form id="login-form" class="auth-form">
        ${field("Login", "login", "", true)}
        <label class="field">Senha<input name="senha" type="password" required autocomplete="current-password"></label>
        <button class="primary" type="submit">Entrar</button>
      </form>
      ${d.available ? `<div class="auth-divider">ACESSO RÁPIDO DE TESTES</div><div class="auth-roles">
        <button class="secondary role-choice" data-demo="admin">Administrador <span aria-hidden="true">→</span></button>
        <button class="secondary role-choice" data-demo="visualizador">Visualizador <span aria-hidden="true">→</span></button>
        <button class="secondary role-choice" data-demo="conferente">Conferente <span aria-hidden="true">→</span></button>
        </div><p class="data-note">Contas fictícias. Não usa dados da produção.</p>` : ""}
    </section>`;
    $("#login-form").onsubmit = e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.currentTarget));
      asyncAction(async () => { state.user = await json("POST", "/api/auth/login", f); void connectRealtime(); location.hash = state.user.papel === "conferente" ? "conferente" : "recebimento"; await navigate(); });
    };
    $$("[data-demo]").forEach(button => {
      button.onclick = () => asyncAction(async () => {
        state.user = await json("POST", "/api/auth/demo-login", { papel: button.dataset.demo });
        void connectRealtime();
        location.hash = state.user.papel === "conferente" ? "conferente" : "recebimento";
        await navigate();
      });
    });
  };
  const restoreShell = () => {
    shell.classList.remove("unauthenticated");
    $(".sidebar").hidden = false; $(".topbar").hidden = false; $(".footer").hidden = false;
    root.classList.remove("auth-main");
    $(".account-name strong").textContent = state.user.nome || "Usuário";
    $(".account-name small").textContent = statusLabel(state.user.papel);
    $$(".sidebar-nav a[data-view-link]").forEach(a => {
      const admin = state.user.papel === "admin";
      const viewer = state.user.papel === "visualizador";
      const view = a.dataset.viewLink;
      a.hidden = (view === "conferente" && state.user.papel !== "conferente") ||
        (view !== "conferente" && state.user.papel === "conferente") ||
        ((view === "lojas" || view === "usuarios") && !admin) ||
        (view === "relatorios" && !admin && !viewer);
    });
  };
  const navigate = async () => {
    const requestToken = ++navigationToken;
    if (!state.user) { await makeLogin(); return; }
    restoreShell();
    const role = state.user.papel;
    let next = location.hash.slice(1) || (role === "conferente" ? "conferente" : "recebimento");
    const openImportAfterRoute = next === "importar" && role === "admin";
    if (next === "importar") {
      next = role === "conferente" ? "conferente" : "recebimento";
      history.replaceState(null, "", `${location.pathname}${location.search}#${next}`);
    }
    if (role === "conferente") next = "conferente";
    if (role === "visualizador" && !["recebimento", "relatorios"].includes(next)) next = "recebimento";
    if (!(next in pageTitles)) next = "recebimento";
    state.view = next;
    $("#breadcrumb").textContent = pageTitles[next];
    $$(".sidebar-nav a[data-view-link]").forEach(a => {
      a.classList.toggle("active", a.dataset.viewLink === next);
      if (a.dataset.viewLink === next) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    shell.classList.remove("nav-open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    root.innerHTML = `<div class="loading" role="status">Carregando informações…</div>`;
    try {
      const pages = { recebimento: showDashboard, relatorios: showReports, conferente: showConferente, lojas: showStores, usuarios: showUsers };
      await pages[next]({ ...context, isCurrent: () => navigationToken === requestToken });
      if (navigationToken !== requestToken) return;
      if (openImportAfterRoute) openImportDialog(context);
    } catch (e) {
      if (navigationToken !== requestToken) return;
      root.innerHTML = heading("Agenda Prado", "Não foi possível carregar", e.message || "Verifique sua conexão.") + `<button class="secondary" id="retry">Tentar novamente</button>`;
      $("#retry").onclick = () => navigate();
    }
  };
  async function loadStores() { state.stores = await api("/api/admin/stores"); return state.stores; }
  const context = { state, root, shell, $, $$, dateToday, esc, fmt, dt, statusLabel, badge, heading, panel, stats, table, storeOpts, api, json, tell, setBusy, asyncAction, modal, field, navigate, loadStores };
  Object.assign(context, createAgendaController(context));
  document.addEventListener("click", e => {
    const trigger = e.target.closest?.("[data-open-import]");
    if (!trigger || trigger.disabled) return;
    e.preventDefault();
    openImportDialog(context, trigger);
  });
  const markPresenceInteraction = () => {
    if (state.user?.papel !== "conferente" || document.hidden) return;
    const now = Date.now();
    if (now - lastPresenceInteraction < 20_000) return;
    lastPresenceInteraction = now;
    sendPresence();
    void touchPresence(true);
  };
  document.addEventListener("pointerdown", markPresenceInteraction);
  document.addEventListener("keydown", markPresenceInteraction);
  window.addEventListener("hashchange", () => navigate());
  $("#menu-toggle").onclick = () => {
    const on = shell.classList.toggle("nav-open");
    $("#menu-toggle").setAttribute("aria-expanded", String(on));
  };
  const footer = $(".footer");
  if (footer) footer.textContent = "Agenda Prado · Worker Preview · D1 fictício";
  $(".preview-chip").textContent = "PREVIEW · D1 ISOLADO";
  const oldBottom = $(".sidebar-bottom p"); if (oldBottom) oldBottom.textContent = "Ambiente exclusivo de testes. Nenhum dado de produção é utilizado.";
  const menu = $(".sidebar-nav");
  menu.insertAdjacentHTML("beforeend", `<button class="secondary sidebar-logout" id="sidebar-logout">Sair</button>`);
  $("#sidebar-logout").onclick = () => asyncAction(async () => {
    await api("/api/auth/logout", { method: "POST" }); closeRealtime(); state.user = null; location.hash = ""; await makeLogin();
  });
  (async () => {
    try { state.user = await api("/api/auth/me"); if (state.user) void connectRealtime(); }
    catch (e) { if (e.status !== 401) tell("Serviço temporariamente indisponível.", true); }
    await navigate();
  })();
})();
