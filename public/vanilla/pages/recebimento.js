// Tela dashboard — JavaScript puro.
export async function showDashboard(ctx) {
  const { state, root, $, $$, api, navigate, esc, dt, fmt, heading, stats, panel, table, badge, storeOpts, asyncAction, loadStores, openAgenda, isCurrent } = ctx;

    const [stores, agendas, presence] = await Promise.all([
      loadStores(),
      api(`/api/admin/agendas?date=${encodeURIComponent(state.date)}`),
      api("/api/admin/presence").catch(() => []),
    ]);
    if (!isCurrent()) return;
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
