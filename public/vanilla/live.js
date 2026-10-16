(function nativeApp() {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const root = $("#main");
  const shell = $(".app-shell");
  const dateToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const state = { user: null, view: "recebimento", date: dateToday(), search: "", store: "", reportStore: "", agendas: [], stores: [], users: [], storeAgenda: null, detail: null, detailDialogClose: null, detailOpener: null, history: [], busy: false, edit: false };
  let realtimeSocket = null;
  let realtimeTimer = null;
  let refreshScheduled = null;
  const sendPresence = () => {
    if (realtimeSocket?.readyState !== WebSocket.OPEN || state.user?.papel !== "conferente") return;
    realtimeSocket.send(JSON.stringify({ version: 1, type: "presence.set", status: document.hidden ? "away" : "online" }));
  };
  const closeRealtime = () => {
    if (realtimeTimer) clearInterval(realtimeTimer);
    if (refreshScheduled) clearTimeout(refreshScheduled);
    realtimeTimer = null;
    refreshScheduled = null;
    realtimeSocket?.close(1000, "sessão encerrada");
    realtimeSocket = null;
  };
  const liveRefresh = () => {
    if (document.hidden || !state.user || state.busy || $("#dialog-host")?.children.length) return;
    if (!["conferente", "recebimento", "relatorios"].includes(state.view)) return;
    clearTimeout(refreshScheduled);
    refreshScheduled = setTimeout(() => void navigate(), 450);
  };
  const connectRealtime = async () => {
    closeRealtime();
    if (!state.user) return;
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
  const pageTitles = { recebimento: "Recebimento", relatorios: "Relatórios gerenciais", conferente: "Conferente", lojas: "Lojas", usuarios: "Usuários", historico: "Histórico" };
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
    shell.classList.add("unauthenticated");
    $(".sidebar").hidden = true;
    $(".topbar").hidden = true;
    $(".footer").hidden = true;
    root.classList.add("auth-main");
    state.user = null;
    const d = await api("/api/auth/demo-status").catch(() => ({ available: false }));
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
        ((view === "lojas" || view === "usuarios" || view === "historico") && !admin) ||
        (view === "relatorios" && !admin && !viewer);
    });
  };
  const navigate = async () => {
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
      const pages = { recebimento: showDashboard, relatorios: showReports, conferente: showConferente, lojas: showStores, usuarios: showUsers, historico: showHistory };
      await pages[next]();
      if (openImportAfterRoute) openImportDialog();
    } catch (e) {
      root.innerHTML = heading("Agenda Prado", "Não foi possível carregar", e.message || "Verifique sua conexão.") + `<button class="secondary" id="retry">Tentar novamente</button>`;
      $("#retry").onclick = () => navigate();
    }
  };
  async function loadStores() { state.stores = await api("/api/admin/stores"); return state.stores; }
  async function showDashboard() {
    const [stores, agendas, presence] = await Promise.all([
      loadStores(),
      api(`/api/admin/agendas?date=${encodeURIComponent(state.date)}`),
      api("/api/admin/presence").catch(() => []),
    ]);
    state.agendas = agendas;
    const map = new Map(agendas.map(x => [x.storeCode, x]));
    const online = new Map(presence.map(x => [x.storeId, x.status]));
    const filtered = stores.filter(s => s.ativo && s.temConferenteAtivo !== false && (!state.store || state.store === s.codigo));
    const active = filtered.map(s => ({ ...s, ag: map.get(s.codigo) }));
    const totals = active.reduce((a, s) => {
      const ag = s.ag;
      a.total += ag?.total || 0; a.received += ag?.recebido || 0;
      a.missed += (ag?.naoChegou || 0) + (ag?.recusado || 0);
      a.pending += ag?.aguardando || 0;
      return a;
    }, { total: 0, received: 0, missed: 0, pending: 0 });
    root.innerHTML = `<div class="dashboard-page">` + heading("Painel administrativo", "Recebimento", `Resumo operacional de ${dt(state.date)} · ${state.user.papel === "visualizador" ? "Somente consulta" : "Gestão"}`, state.user.papel === "admin" ? `<button class="primary" type="button" data-open-import>Importar agenda</button>` : "") +
      stats([["Agendamentos", totals.total, "Total programado"], ["Recebidos", totals.received, "Confirmados"], ["Não recebidos", totals.missed, "Ocorrências"], ["Aguardando", totals.pending, "Pendentes"]]) +
      `<div class="toolbar"><div><h2>Operação por loja</h2><p>Acompanhamento diário em uma única visualização</p></div><div class="filters-inline"><label class="field">Data<input type="date" id="dash-date" value="${esc(state.date)}"></label><label class="field">Loja<select id="dash-store">${storeOpts(state.store)}</select></label><button class="secondary" id="dash-refresh">Atualizar</button></div></div>` +
      panel("Unidades", "Lojas ativas com conferente ativo", table(["Presença", "Loja", "Agenda", "Total", "Recebidos", "Não recebidos", "Aguardando", "Situação", "Ação"], active.map(s => `<tr>
        <td>${badge(online.get(s.id) || "offline")}</td><td class="cell-primary">${esc(s.codigo)} · ${esc(s.nome)}</td>
        <td><span class="agenda-mark">${s.ag ? "Importada" : "Sem agenda"}</span></td>
        <td class="numeric">${fmt(s.ag?.total)}</td><td class="numeric">${fmt(s.ag?.recebido)}</td>
        <td class="numeric">${fmt((s.ag?.naoChegou || 0) + (s.ag?.recusado || 0))}</td>
        <td class="numeric">${fmt(s.ag?.aguardando)}</td>
        <td>${s.ag ? badge(s.ag.dayStatus === "concluido" ? "concluido" : "aberto") : "—"}</td>
        <td>${s.ag ? `<button class="mini-button" data-detail="${esc(s.ag.id)}">Ver agenda</button>` : "—"}</td>
        </tr>`))) + `</div>`;
    $("#dash-date").onchange = e => { state.date = e.target.value; navigate(); };
    $("#dash-store").onchange = e => { state.store = e.target.value; navigate(); };
    $("#dash-refresh").onclick = navigate;
    $$("[data-detail]").forEach(b => b.onclick = () => asyncAction(() => openAgenda(b.dataset.detail, b)));
  }
  const updateStatus = async (id, status, apiBase) => {
    await json("PATCH", `${apiBase}/${encodeURIComponent(id)}/status`, { status });
    if (!await refreshDetailDialog()) await navigate();
    tell("Status salvo no D1 de testes.");
  };
  const listAppointments = (items, apiBase, editable) => table(
    ["Horário", "Fornecedor", "Protocolo", "Status", "Trocas", "Observações", editable ? "Ações" : "Detalhes"],
    items.map(a => `<tr><td>${esc(a.startTime || "—")}</td><td class="cell-primary">${esc(a.supplier)}</td><td>${esc(a.protocol)}</td><td>${badge(a.status)}</td>
      <td>${editable ? `<input type="checkbox" aria-label="Trocas ${esc(a.supplier)}" data-exchange="${esc(a.id)}" ${a.hasExchanges ? "checked" : ""}>` : (a.hasExchanges ? "Sim" : "Não")}</td>
      <td class="detail-line">${esc(a.observation || "—")}</td>
      <td>${editable ? `<div class="inline-actions"><button class="mini-button" data-status="${esc(a.id)}" data-next="recebido" title="Recebido ou Aguardando">✓</button><button class="mini-button" data-status="${esc(a.id)}" data-next="nao_chegou" title="Não recebido ou Aguardando">✕</button>${a.origin === "manual" ? `<button class="mini-button" data-manual-edit="${esc(a.id)}">Editar</button><button class="mini-button" data-manual-remove="${esc(a.id)}">Excluir</button>` : ""}</div>` : "—"}</td></tr>`)
  );
  const bindAppointments = (items, base) => {
    $$("[data-status]").forEach(button => button.onclick = () => {
      const a = items.find(x => x.id === button.dataset.status);
      if (!a) return;
      const desired = a.status === button.dataset.next ? "aguardando" : button.dataset.next;
      if(desired==="nao_chegou"){
        modal("Motivo do não recebimento",
          '<label class="field">Observação obrigatória<textarea name="observation" required maxlength="240" rows="4" placeholder="Descreva o motivo"></textarea></label>',
          "Salvar",async data=>{
            if(!data.observation.trim())throw Error("Informe o motivo.");
            await json("PATCH",`${base}/${encodeURIComponent(a.id)}/status`,{status:desired,observation:data.observation.trim()});
            if (!await refreshDetailDialog()) await navigate();
            tell("Motivo salvo no D1 de testes.");
          });
      } else asyncAction(()=>updateStatus(a.id,desired,base));
    });
    $$("[data-exchange]").forEach(input => input.onchange = e => asyncAction(async () => {
      await json("PATCH", `${base}/${encodeURIComponent(input.dataset.exchange)}/exchanges`, { hasExchanges: e.target.checked });
      tell("Trocas atualizadas."); if (!await refreshDetailDialog()) await navigate();
    }));
    $$("[data-manual-edit]").forEach(button => button.onclick = () => {
      const a = items.find(x => x.id === button.dataset.manualEdit);
      manualDialog(a);
    });
    $$("[data-manual-remove]").forEach(button => button.onclick = () => asyncAction(async () => {
      const a = items.find(x => x.id === button.dataset.manualRemove);
      if (!a || !confirm(`Excluir o fornecedor ${a.supplier}?`)) return;
      await api(`${base}/${encodeURIComponent(a.id)}/manual`, { method: "DELETE" });
      if (!await refreshDetailDialog()) await navigate(); tell("Fornecedor removido.");
    }));
  };
  const openAgenda = async (id, opener = document.activeElement) => {
    const data = await api("/api/admin/agendas/" + encodeURIComponent(id));
    state.detail = data;
    state.edit = false;
    state.detailOpener = opener;
    await showAgendaDetail();
  };
  const showAgendaDetail = async () => {
    const { agenda, appointments } = state.detail;
    const editable = state.user.papel === "admin" && state.edit && agenda.dayStatus !== "concluido";
    const body = heading("Agenda da loja", `${agenda.storeCode} · ${agenda.storeName}`, `Data: ${dt(agenda.date)} · ${statusLabel(agenda.dayStatus)}`,
      `${state.user.papel === "admin" ? `<button class="secondary" id="edit-agenda">${state.edit ? "Sair da edição" : "Modo editar"}</button>` : ""}
       <button class="icon-button" id="agenda-back" type="button" aria-label="Fechar agenda">×</button>`) +
      (state.user.papel === "admin" && agenda.dayStatus === "concluido" ? `<button class="secondary" id="reopen">Reabrir agenda</button>` : "") +
      (editable ? `<div class="toolbar"><button class="secondary" id="add-to-agenda">Adicionar fornecedor sem agenda</button></div>` : "") +
      panel("Agendamentos", `${fmt(appointments.length)} fornecedores`, listAppointments(appointments, "/api/admin/appointments", editable));

    const host = $("#dialog-host");
    const focusId = document.activeElement?.id;
    let dialog = $(".agenda-dialog", host);
    const firstOpen = !dialog;
    if (firstOpen) {
      const opener = state.detailOpener || document.activeElement;
      host.innerHTML = '<div class="dialog-backdrop" id="agenda-dialog-backdrop"><section class="dialog import-dialog agenda-dialog" role="dialog" aria-modal="true" tabindex="-1"><div class="import-dialog-content agenda-dialog-content" id="agenda-dialog-content"></div></section></div><div id="agenda-form-host"></div>';
      dialog = $(".agenda-dialog", host);
      const close = () => {
        host.replaceChildren();
        document.body.classList.remove("dialog-open");
        document.removeEventListener("keydown", onKey);
        state.detailDialogClose = null;
        state.detail = null;
        state.detailOpener = null;
        state.edit = false;
        opener?.focus?.();
      };
      const onKey = e => {
        const nested = $("#agenda-form-host", host);
        if (e.key === "Escape") {
          if (nested?.children.length) return;
          e.preventDefault();
          close();
          return;
        }
        if (e.key !== "Tab" || nested?.children.length) return;
        const items = $$("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])", dialog);
        if (!items.length) return;
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      state.detailDialogClose = close;
      document.body.classList.add("dialog-open");
      document.addEventListener("keydown", onKey);
      $("#agenda-dialog-backdrop", host).addEventListener("click", e => {
        if (e.target === e.currentTarget && !$("#agenda-form-host", host)?.children.length) close();
      });
    }
    const content = $("#agenda-dialog-content", host);
    content.innerHTML = body;
    const title = $("h1", content);
    if (title) {
      title.id = "agenda-dialog-title";
      dialog.setAttribute("aria-labelledby", title.id);
    }
    $("#agenda-back", content).onclick = () => state.detailDialogClose?.();
    $("#edit-agenda", content)?.addEventListener("click", () => { state.edit = !state.edit; showAgendaDetail(); });
    $("#reopen", content)?.addEventListener("click", () => asyncAction(async () => {
      if (!confirm("Reabrir a agenda desta loja?")) return;
      await json("PATCH", "/api/admin/agendas/" + encodeURIComponent(agenda.id) + "/status", { status: "aberto" });
      state.detail = await api("/api/admin/agendas/" + encodeURIComponent(agenda.id));
      state.edit = true;
      await showAgendaDetail();
    }, "Agenda reaberta."));
    $("#add-to-agenda", content)?.addEventListener("click", () => manualDialog(null, agenda.id));
    if (editable) bindAppointments(appointments, "/api/admin/appointments");
    if (firstOpen) dialog.focus();
    else if (focusId) {
      const focusTarget = $("#" + focusId, host);
      if (focusTarget) focusTarget.focus();
      else dialog.focus();
    } else dialog.focus();
  };
  async function refreshDetailDialog() {
    const agendaId = state.detail?.agenda?.id;
    if (!agendaId || !$(".agenda-dialog", $("#dialog-host"))) return false;
    state.detail = await api("/api/admin/agendas/" + encodeURIComponent(agendaId));
    await showAgendaDetail();
    return true;
  }

  const manualDialog = (a, adminAgendaId = null) => {
    const edit = Boolean(a);
    const admin = state.user.papel === "admin";
    const rootUrl = admin ? "/api/admin" : "/api/store";
    const target = edit ? `${rootUrl}/appointments/${encodeURIComponent(a.id)}/manual`
      : admin ? `${rootUrl}/agendas/${encodeURIComponent(adminAgendaId)}/manual`
        : `${rootUrl}/agenda/${encodeURIComponent(state.date)}/manual`;
    modal(edit ? "Editar fornecedor" : "Fornecedor sem agenda", field("Fornecedor", "supplier", a?.supplier || ""), "Salvar", async data => {
      await json(edit ? "PATCH" : "POST", target, { supplier: data.supplier.trim() });
      if (admin && state.detail) {
        state.detail = await api(`/api/admin/agendas/${encodeURIComponent(state.detail.agenda.id)}`);
        await showAgendaDetail();
      } else await navigate();
      tell("Fornecedor atualizado.");
    });
  };
  async function showConferente() {
    const today = dateToday();
    const data = await api(state.date === today ? "/api/store/today" : `/api/store/history/${encodeURIComponent(state.date)}`);
    state.storeAgenda = data;
    const ag = data.agenda, items = data.appointments || [];
    const editable = ag?.dayStatus === "aberto";
    root.innerHTML = heading("Operação de loja", "Conferência de recebimentos", `${state.user.lojaCodigo || ""} · ${state.user.lojaNome || ""} · ${dt(state.date)}`,
      `<button class="secondary" id="conf-prev">‹</button><label class="field">Dia<input type="date" id="conf-date" value="${esc(state.date)}"></label><button class="secondary" id="conf-next">›</button>`) +
      stats([["Total", items.length, "Agendamentos"], ["Recebidos", items.filter(x => x.status === "recebido").length, "Confirmados"], ["Não recebidos", items.filter(x => x.status === "nao_chegou").length, "Ocorrências"], ["Aguardando", items.filter(x => x.status === "aguardando").length, "Pendentes"]]) +
      (ag ? `<div class="toolbar"><div><h2>${esc(ag.storeName)}</h2><p>${esc(ag.dayStatus === "concluido" ? "Dia concluído" : "Dia aberto para conferência")}</p></div><div class="filters-inline">${editable ? `<button class="secondary" id="conf-add">Fornecedor sem agenda</button><button class="primary" id="conf-complete">Concluir dia</button>` : ""}<button class="secondary" id="conf-print">Imprimir / PDF</button></div></div>` : "") +
      (ag ? panel("Agenda de recebimento", `${items.length} registros`, listAppointments(items, "/api/store/appointments", editable)) :
        `<div class="empty">Nenhuma agenda para esta data.</div>`);
    $("#conf-date").onchange = e => { state.date = e.target.value; navigate(); };
    const step = diff => {
      const d = new Date(`${state.date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + diff);
      state.date = d.toISOString().slice(0, 10); navigate();
    };
    $("#conf-prev").onclick = () => step(-1); $("#conf-next").onclick = () => step(1);
    $("#conf-print")?.addEventListener("click", () => asyncAction(async () => {
      if (!ag) return;
      const pdf=await import("./exportAgendaPdf.js");
      pdf.downloadAgendaPdf(ag, items);
    }));
    $("#conf-add")?.addEventListener("click", () => manualDialog(null));
    $("#conf-complete")?.addEventListener("click", () => asyncAction(async () => {
      if (!confirm("Concluir os recebimentos deste dia?")) return;
      await api(`/api/store/agenda/${encodeURIComponent(state.date)}/complete`, { method: "POST" });
      await navigate(); tell("Dia concluído.");
    }));
    if (editable) bindAppointments(items, "/api/store/appointments");
  }
  async function showStores() {
    await loadStores();
    root.innerHTML = heading("Cadastros", "Lojas", "Administração das unidades e vínculos de conferentes.",
      `<button class="primary" id="new-store">Nova loja</button>`) +
      panel("Lojas cadastradas", `${state.stores.length} registros`, table(["Código", "Nome", "Situação", "Ação"],
        state.stores.map(s => `<tr><td class="cell-primary">${esc(s.codigo)}</td><td>${esc(s.nome)}</td><td>${badge(s.ativo ? "ativo" : "inativo")}</td>
          <td><button class="mini-button" data-edit-store="${esc(s.id)}">Editar</button></td></tr>`)));
    $("#new-store").onclick = () => storeDialog();
    $$("[data-edit-store]").forEach(b => b.onclick = () => storeDialog(state.stores.find(x => x.id === b.dataset.editStore)));
  }
  const storeDialog = (store = null) => {
    const body = field("Código", "codigo", store?.codigo || "") + field("Nome", "nome", store?.nome || "") +
      (store ? `<label class="field">Situação<select name="ativo"><option value="true" ${store.ativo ? "selected" : ""}>Ativa</option><option value="false" ${store.ativo ? "" : "selected"}>Inativa</option></select></label>` : "");
    const form = modal(store ? "Editar loja" : "Nova loja", body, "Salvar", async data => {
      await json(store ? "PATCH" : "POST", "/api/admin/stores", {
        ...(store ? { id: store.id } : {}), codigo: data.codigo.trim().toUpperCase(), nome: data.nome.trim(),
        ...(store ? { ativo: data.ativo === "true" } : {}),
      });
      await navigate(); tell("Loja salva.");
    });
    return form;
  };
  async function showUsers() {
    const [users] = await Promise.all([api("/api/admin/users"), loadStores()]);
    state.users = users;
    root.innerHTML = heading("Cadastros", "Usuários", "Controle de acesso e permissões, sem apagar o histórico.", `<button class="primary" id="new-user">Novo usuário</button>`) +
      panel("Usuários cadastrados", `${users.length} registros`, table(["Nome", "Login", "Perfil", "Loja", "Situação", "Ação"],
        users.map(u => `<tr><td class="cell-primary">${esc(u.nome)}</td><td>${esc(u.login)}</td><td>${esc(statusLabel(u.papel))}</td>
          <td>${esc(state.stores.find(s => s.id === u.lojaId)?.nome || "—")}</td><td>${badge(u.ativo ? "ativo" : "inativo")}</td>
          <td><button class="mini-button" data-edit-user="${esc(u.id)}">Editar</button></td></tr>`)));
    $("#new-user").onclick = () => userDialog();
    $$("[data-edit-user]").forEach(b => b.onclick = () => userDialog(users.find(x => x.id === b.dataset.editUser)));
  }
  const userDialog = (user = null) => {
    const roles = [["conferente", "Conferente"], ["visualizador", "Visualizador"], ["admin", "Administrador"]];
    const body = field("Nome", "nome", user?.nome || "") + field("Login", "login", user?.login || "") +
      `<label class="field">Perfil<select name="papel" id="role-selector">${roles.map(([id, name]) => `<option value="${id}" ${id === (user?.papel || "conferente") ? "selected" : ""}>${name}</option>`).join("")}</select></label>
      <label class="field" id="store-selector">Loja<select name="lojaId"><option value="">Selecione</option>${state.stores.map(s => `<option value="${esc(s.id)}" ${s.id === user?.lojaId ? "selected" : ""}>${esc(s.codigo)} · ${esc(s.nome)}</option>`).join("")}</select></label>
      <label class="field">${user ? "Nova senha (opcional)" : "Senha (mínimo 12 caracteres)"}<input name="senha" type="password" autocomplete="new-password" minlength="12" ${user ? "" : "required"}></label>
      ${user ? `<label class="field">Acesso<select name="ativo"><option value="true" ${user.ativo ? "selected" : ""}>Ativo</option><option value="false" ${user.ativo ? "" : "selected"}>Desativado</option></select></label>` : ""}`;
    const dialog = modal(user ? "Editar usuário" : "Novo usuário", body, "Salvar", async data => {
      if (data.papel === "conferente" && !data.lojaId) throw new Error("Selecione uma loja para o conferente.");
      await json(user ? "PATCH" : "POST", "/api/admin/users", {
        ...(user ? { id: user.id } : {}),
        nome: data.nome.trim(), login: data.login.trim(), papel: data.papel,
        ...(data.papel === "conferente" ? { lojaId: data.lojaId } : {}),
        ...(data.senha ? { senha: data.senha } : {}),
        ...(user ? { ativo: data.ativo === "true" } : {}),
      });
      await navigate(); tell("Usuário atualizado.");
    });
    const role = $("#role-selector", dialog.host);
    const setRole = () => $("#store-selector", dialog.host).hidden = role.value !== "conferente";
    role.onchange = setRole; setRole();
  };
  async function showHistory() {
    await loadStores();
    const params = new URLSearchParams();
    if (state.store) params.set("storeCode", state.store);
    if (state.date) params.set("date", state.date);
    const agendas = await api(`/api/admin/agendas?${params}`);
    root.innerHTML = heading("Registros", "Histórico de agendas", "Consulte uma agenda e seus eventos para auditoria.") +
      `<div class="filter-panel filters-inline"><label class="field">Data<input type="date" id="hist-date" value="${esc(state.date)}"></label><label class="field">Loja<select id="hist-store">${storeOpts(state.store)}</select></label><button id="hist-all" class="secondary">Todas as datas</button></div>` +
      panel("Agendas", `${agendas.length} registros`, table(["Data", "Loja", "Total", "Aguardando", "Recebidos", "Situação", "Detalhes"], agendas.map(ag =>
        `<tr><td>${dt(ag.date)}</td><td>${esc(ag.storeCode)} · ${esc(ag.storeName)}</td><td>${fmt(ag.total)}</td><td>${fmt(ag.aguardando)}</td><td>${fmt(ag.recebido)}</td><td>${badge(ag.dayStatus)}</td><td><button class="mini-button" data-detail="${esc(ag.id)}">Ver</button></td></tr>`)));
    $("#hist-date").onchange = e => { state.date = e.target.value; navigate(); };
    $("#hist-store").onchange = e => { state.store = e.target.value; navigate(); };
    $("#hist-all").onclick = () => { state.date = ""; navigate(); };
    $$("[data-detail]").forEach(b => b.onclick = () => asyncAction(() => openAgenda(b.dataset.detail, b)));
  }
  async function showReports(){
  await loadStores();
  if(!state.reportEnd)state.reportEnd=dateToday();
  if(!state.reportStart){const d=new Date(state.reportEnd+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-29);state.reportStart=d.toISOString().slice(0,10)}
  const range=(start,end)=>{
    const q=new URLSearchParams({start,end});
    if(state.reportStore)q.set("storeCode",state.reportStore);
    return q.toString();
  };
  const days=(Date.parse(state.reportEnd+"T00:00:00Z")-Date.parse(state.reportStart+"T00:00:00Z"))/86400000+1;
  if(days<1||days>93)throw Error("Selecione um período válido de até 93 dias.");
  const previousEnd=new Date(state.reportStart+"T00:00:00Z");previousEnd.setUTCDate(previousEnd.getUTCDate()-1);
  const previousStart=new Date(previousEnd);previousStart.setUTCDate(previousStart.getUTCDate()-days+1);
  const [report,earlier,occurrences]=await Promise.all([
    api("/api/admin/reports?"+range(state.reportStart,state.reportEnd)),
    state.reportCompare?api("/api/admin/reports?"+range(previousStart.toISOString().slice(0,10),previousEnd.toISOString().slice(0,10))):Promise.resolve(null),
    api("/api/admin/reports/occurrences?"+range(state.reportStart,state.reportEnd)+"&limit=100&offset="+(state.reportOffset||0)),
  ]);
  const totals=rows=>rows.reduce((a,x)=>{
    for(const k of ["total","recebido","naoChegou","aguardando","recusado"])a[k]+=x[k]||0;
    if(x.dayStatus==="aberto")a.open++;
    return a;
  },{total:0,recebido:0,naoChegou:0,aguardando:0,recusado:0,open:0});
  const t=totals(report.rows),p=totals(earlier?.rows||[]);
  const rate=x=>x.total?x.recebido/x.total*100:0;
  const delta=(rate(t)-rate(p)).toFixed(1).replace(".",",");
  const groups=new Map();
  for(const row of report.rows){
    const x=groups.get(row.storeCode)||{name:row.storeName,total:0,recebido:0,naoChegou:0};
    x.total+=row.total;x.recebido+=row.recebido;x.naoChegou+=row.naoChegou;
    groups.set(row.storeCode,x);
  }
  root.innerHTML=heading("Indicadores de gestão","Relatórios gerenciais",`${dt(state.reportStart)} a ${dt(state.reportEnd)}`,'<button class="secondary" id="report-csv">Exportar CSV</button>')+
    `<form class="filter-panel" id="report-form"><div class="filter-grid">
      <label class="field">De<input name="start" type="date" value="${esc(state.reportStart)}" required></label>
      <label class="field">Até<input name="end" type="date" value="${esc(state.reportEnd)}" required></label>
      <label class="field wide">Loja<select name="storeCode">${storeOpts(state.reportStore)}</select></label>
      <label class="checkbox-line"><input name="compare" type="checkbox" ${state.reportCompare?"checked":""}> Comparar com período anterior</label>
      <button class="primary" type="submit">Aplicar filtros</button></div></form>`+
    stats([["Agendamentos",fmt(t.total),`${report.rows.length} agendas no período`],["Recebidos",fmt(t.recebido),rate(t).toFixed(1).replace(".",",")+"%"],["Não recebidos",fmt(t.naoChegou),"Ocorrências"],["Aguardando",fmt(t.aguardando),`${t.open} agendas em aberto`]])+
    (earlier?`<div class="alert">Período anterior: ${fmt(p.total)} agendamentos · Variação na taxa de recebimento: <strong>${rate(t)>=rate(p)?"+":""}${delta} p.p.</strong></div>`:"")+
    `<div class="grid-2">`+
    panel("Por loja","Taxas e volumes por unidade",table(["Loja","Total","Recebidos","Não recebidos","Taxa"],[...groups].map(([code,x])=>`<tr><td class="cell-primary">${esc(code)} · ${esc(x.name)}</td><td>${fmt(x.total)}</td><td>${fmt(x.recebido)}</td><td>${fmt(x.naoChegou)}</td><td>${rate(x).toFixed(1).replace(".",",")}%</td></tr>`)))+
    panel("Fornecedores com ocorrências","Ranking de não recebidos",`<div class="ranking">${report.suppliers.map((x,i)=>`<div class="ranking-item"><span class="ranking-order">${i+1}</span><span class="ranking-name">${esc(x.supplier)}</span><span class="ranking-count">${x.naoChegou}</span></div>`).join("")||'<div class="empty">Sem ocorrências.</div>'}</div>`)+`</div>`+
    panel("Por data","Distribuição dos recebimentos",table(["Data","Loja","Total","Recebidos","Não recebidos","Aguardando"],report.rows.map(x=>`<tr><td>${dt(x.date)}</td><td>${esc(x.storeName)}</td><td>${fmt(x.total)}</td><td>${fmt(x.recebido)}</td><td>${fmt(x.naoChegou)}</td><td>${fmt(x.aguardando)}</td></tr>`)))+
    panel("Ocorrências e observações",`${fmt(occurrences.total)} registros`,table(["Dia","Loja","Fornecedor","Protocolo","Motivo"],occurrences.rows.map(x=>`<tr><td>${dt(x.date)}</td><td>${esc(x.storeName)}</td><td class="cell-primary">${esc(x.supplier)}</td><td>${esc(x.protocol)}</td><td class="detail-line">${esc(x.observation||"Motivo não registrado")}</td></tr>`))+
      `<div class="dialog-actions" style="padding:12px 20px"><button class="secondary" id="report-prev" ${(state.reportOffset||0)===0?"disabled":""}>Anterior</button><button class="secondary" id="report-next" ${(state.reportOffset||0)+100>=occurrences.total?"disabled":""}>Próxima</button></div>`);
  $("#report-form").onsubmit=e=>{
    e.preventDefault();const f=new FormData(e.currentTarget);
    const days=(Date.parse(f.get("end")+"T00:00:00Z")-Date.parse(f.get("start")+"T00:00:00Z"))/86400000+1;
    if(days<1||days>93){tell("Selecione um período de até 93 dias.",true);return}
    state.reportStart=f.get("start");state.reportEnd=f.get("end");state.reportStore=f.get("storeCode");state.reportCompare=f.has("compare");state.reportOffset=0;navigate();
  };
  $("#report-prev").onclick=()=>{state.reportOffset=Math.max(0,(state.reportOffset||0)-100);navigate()};
  $("#report-next").onclick=()=>{state.reportOffset=(state.reportOffset||0)+100;navigate()};
  $("#report-csv").onclick=()=>{
    const rows=[["Data","Loja","Total","Recebidos","Não recebidos","Aguardando"],...report.rows.map(x=>[x.date,x.storeCode,x.total,x.recebido,x.naoChegou,x.aguardando])];
    const safeCell=v=>{let s=String(v??"");if(/^[\s\u0000-\u001f]*[=+\-@]/.test(s))s="'"+s;return `"${s.replace(/"/g,'""')}"`};
    const data="\uFEFF"+rows.map(r=>r.map(safeCell).join(";")).join("\r\n");
    const url=URL.createObjectURL(new Blob([data],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="relatorio-agenda-prado.csv";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
}
  function openImportDialog(opener = document.activeElement) {
    if (state.user?.papel !== "admin" || state.busy || $("#dialog-host").children.length) return;
    const returnFocus = opener.closest?.(".sidebar") && shell.classList.contains("nav-open") ? $("#menu-toggle") : opener;
    shell.classList.remove("nav-open");
    $("#menu-toggle").setAttribute("aria-expanded", "false");
    const host = $("#dialog-host");
    host.innerHTML = `<div class="dialog-backdrop"><section class="dialog import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-dialog-title" tabindex="-1">
      <header class="import-dialog-header">
        <div><p class="eyebrow">Operação</p><h2 id="import-dialog-title">Importar agenda</h2><p class="import-dialog-note">Selecione um arquivo CSV ou PDF e confira os registros antes de gravar.</p></div>
        <button class="icon-button" id="import-close" type="button" aria-label="Fechar importação">×</button>
      </header>
      <div class="import-dialog-content">
        <label class="field">Arquivo de agenda<input id="import-file" type="file" accept=".csv,text/csv,.pdf,application/pdf"></label>
        <p class="data-note">CSV ou PDF de até 10 MB. Os dados serão gravados apenas no banco isolado da preview.</p>
        <div id="import-preview"></div>
      </div>
      <div class="dialog-actions import-dialog-actions">
        <button class="secondary" type="button" id="import-cancel">Cancelar</button>
        <button class="primary" type="button" id="import-confirm" disabled>Confirmar importação</button>
      </div>
    </section></div>`;
    const dialog = $(".import-dialog", host);
    const close = () => {
      host.replaceChildren();
      document.body.classList.remove("dialog-open");
      document.removeEventListener("keydown", onKey);
      returnFocus?.focus?.();
    };
    const onKey = e => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab") return;
      const items = $$("button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])", dialog);
      if (!items.length) return;
      const first = items[0], last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.body.classList.add("dialog-open");
    document.addEventListener("keydown", onKey);
    $("#import-close", host).onclick = close;
    $("#import-cancel", host).onclick = close;
    $(".dialog-backdrop", host).addEventListener("click", e => { if (e.target === e.currentTarget) close(); });
    const fileInput = $("#import-file", host);
    const target = $("#import-preview", host);
    const confirmButton = $("#import-confirm", host);
    let pendingAgendas = null;
    fileInput.focus();

    fileInput.onchange = async e => {
      const file = e.currentTarget.files?.[0];
      if (!file) return;
      pendingAgendas = null;
      confirmButton.disabled = true;
      target.innerHTML = '<div class="loading" role="status">Lendo arquivo e verificando os registros…</div>';
      if (file.size > 10 * 1024 * 1024) { target.innerHTML = '<div class="alert" role="alert">O arquivo excede 10 MB.</div>'; return; }
      try {
        const tools = await import("./parseAgendaBatch.js");
        const pdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
        if (!pdf && !file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") throw Error("Selecione um CSV ou PDF.");
        const text = pdf ? await (await import("./extractPdfText.js")).extractPdfText(file) : await file.text();
        const preview = pdf ? tools.parseAgendaPdfText(text) : tools.parseAgendaCsv(text);
        const all = preview.agendas.flatMap(x => x.appointments.map(ap => ({ storeCode: x.storeCode, appointment: ap })));
        pendingAgendas = preview.agendas;
        target.innerHTML = stats([["Lojas", preview.agendas.length, "Unidades reconhecidas"], ["Registros", preview.totalAppointments, "Agendamentos"], ["Erros", preview.blockingErrors.length, "Bloqueios"], ["Avisos", preview.warnings.length, "A revisar"]]) +
          (preview.blockingErrors.length ? `<div class="alert" role="alert"><strong>Corrija antes de importar:</strong><ul>${preview.blockingErrors.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "") +
          (preview.warnings.length ? `<div class="alert"><strong>Avisos:</strong><ul>${preview.warnings.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : "") +
          panel("Prévia do arquivo", `${all.length} linhas identificadas`, table(["Loja", "Horário", "Protocolo", "Fornecedor", "Itens", "Volumes", "Tipo"], all.slice(0, 200).map(x => `<tr><td>${esc(x.storeCode)}</td><td>${esc(x.appointment.startTime)}</td><td>${esc(x.appointment.protocol)}</td><td>${esc(x.appointment.supplier)}</td><td>${fmt(x.appointment.items)}</td><td>${fmt(x.appointment.volumes)}</td><td>${esc(x.appointment.type)}</td></tr>`)));
        confirmButton.disabled = preview.blockingErrors.length > 0 || !preview.agendas.length;
      } catch (error) {
        pendingAgendas = null;
        target.innerHTML = `<div class="alert" role="alert">${esc(error.message || "Não foi possível interpretar o arquivo.")}</div>`;
      }
    };

    confirmButton.onclick = () => asyncAction(async () => {
      if (!pendingAgendas?.length) throw Error("Selecione um arquivo válido antes de confirmar.");
      const file = fileInput.files?.[0];
      const agendas = pendingAgendas.map(agenda => ({
        storeCode: agenda.storeCode,
        date: agenda.date,
        originalFileName: file?.name || "",
        appointments: agenda.appointments.map(({ status, ...data }) => data),
      }));
      if (agendas.some(a => !a.storeCode || !a.date) || !agendas.length) throw Error("Verifique a data e as lojas do arquivo.");
      let result;
      try { result = await json("POST", "/api/admin/agendas/import/bulk", { agendas }); }
      catch (error) {
        if (error.status !== 409) throw error;
        if (!confirm("Já existem agendas para algumas lojas e datas. Substituir mantendo as conferências preservadas?")) return;
        result = await json("POST", "/api/admin/agendas/import/bulk", { agendas: agendas.map(x => ({ ...x, replace: true })) });
      }
      const message = `${result.totalAgendas} agendas e ${result.totalAppointments} agendamentos importados.`;
      close();
      await navigate();
      root.focus();
      tell(message);
    });
  }
  document.addEventListener("click", e => {
    const trigger = e.target.closest?.("[data-open-import]");
    if (!trigger || trigger.disabled) return;
    e.preventDefault();
    openImportDialog(trigger);
  });
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
