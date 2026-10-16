import { filterAppointments } from "../features/filtros.js";

// Tela conferente — JavaScript puro.
export async function showConferente(ctx) {
  const { state, root, $, api, navigate, esc, dt, fmt, heading, stats, panel, listAppointments, bindAppointments, asyncAction, manualDialog, tell, dateToday, isCurrent, bindAppointmentDetails } = ctx;

    const today = dateToday();
    const data = await api(state.date === today ? "/api/store/today" : `/api/store/history/${encodeURIComponent(state.date)}`).catch(error => {
      if (error.status === 404 && state.date !== today) return { agenda: null, appointments: [] };
      throw error;
    });
    if (!isCurrent()) return;
    state.storeAgenda = data;
    const ag = data.agenda, items = data.appointments || [];
    const editable = ag?.dayStatus === "aberto";
    root.innerHTML = heading("Operação de loja", "Conferência de recebimentos", `${state.user.lojaCodigo || ""} · ${state.user.lojaNome || ""} · ${dt(state.date)}`,
      `<button class="secondary" id="conf-prev">‹</button><label class="field">Dia<input type="date" id="conf-date" value="${esc(state.date)}"></label><button class="secondary" id="conf-next">›</button><button type="button" class="secondary" id="conf-today">Hoje</button>`) +
      stats([["Total", items.length, "Agendamentos"], ["Recebidos", items.filter(x => x.status === "recebido").length, "Confirmados"], ["Não recebidos", items.filter(x => x.status === "nao_chegou").length, "Ocorrências"], ["Aguardando", items.filter(x => x.status === "aguardando").length, "Pendentes"]]) +
      (ag ? `<div class="toolbar"><div><h2>${esc(ag.storeName)}</h2><p>${esc(ag.dayStatus === "concluido" ? "Dia concluído" : "Dia aberto para conferência")}</p></div><div class="filters-inline">${editable ? `<button class="secondary" id="conf-add">Fornecedor sem agenda</button><button class="primary" id="conf-complete">Concluir dia</button>` : ""}<button class="secondary" id="conf-print">Imprimir / PDF</button></div></div>` : "") +
      (ag ? panel("Agenda de recebimento", `${items.length} registros`,
        `<div class="appointment-toolbar"><label class="field search">Pesquisar fornecedor ou protocolo
          <input type="search" id="conf-search" value="${esc(state.confSearch || "")}" placeholder="Pesquisar fornecedor ou protocolo"></label></div>
          <div id="conf-appointment-table"></div><div id="appointment-details"></div>`) :
        `<div class="empty">Nenhuma agenda para esta data.</div>`);
    $("#conf-date").onchange = e => { state.date = e.target.value; state.confSearch = ""; navigate(); };
    const step = diff => {
      const d = new Date(`${state.date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + diff);
      state.date = d.toISOString().slice(0, 10); state.confSearch = ""; navigate();
    };
    $("#conf-prev").onclick = () => step(-1); $("#conf-next").onclick = () => step(1);
    $("#conf-today").onclick = () => { state.date = today; state.confSearch = ""; navigate(); };
    $("#conf-print")?.addEventListener("click", () => asyncAction(async () => {
      if (!ag) return;
      const pdf=await import("../exportAgendaPdf.js");
      pdf.downloadAgendaPdf(ag, items);
    }));
    $("#conf-add")?.addEventListener("click", () => manualDialog(null));
    $("#conf-complete")?.addEventListener("click", () => asyncAction(async () => {
      if (!confirm("Concluir os recebimentos deste dia?")) return;
      await api(`/api/store/agenda/${encodeURIComponent(state.date)}/complete`, { method: "POST" });
      await navigate(); tell("Dia concluído.");
    }));
    if (ag) {
      const renderFiltered = () => {
        const filtered = filterAppointments(items, state.confSearch || "");
        $("#conf-appointment-table").innerHTML = listAppointments(filtered, "/api/store/appointments", editable);
        if (editable) bindAppointments(filtered, "/api/store/appointments");
        bindAppointmentDetails(filtered, "/api/store/appointments", root);
      };
      $("#conf-search").oninput = event => {
        state.confSearch = event.target.value;
        state.appointmentDetailSeq = (state.appointmentDetailSeq || 0) + 1;
        $("#appointment-details").replaceChildren();
        renderFiltered();
      };
      renderFiltered();
    }
  }
