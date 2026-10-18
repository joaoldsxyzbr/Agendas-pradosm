import { filterAppointments } from "./filtros.js";
import { renderHistory } from "./auditoria.js";

// Detalhes, estados e edição de agendas.
export function createAgendaController(ctx) {
  const { state, root, $, $$, esc, dt, fmt, badge, table, heading, panel, field, statusLabel, modal, json, api, asyncAction, navigate, tell } = ctx;
  const updateStatus = async (id, status, apiBase) => {
    await json("PATCH", `${apiBase}/${encodeURIComponent(id)}/status`, { status });
    if (!await refreshDetailDialog()) await navigate();
    tell("Status salvo no D1 de testes.");
  };
  const listAppointments = (items, apiBase, editable) => table(
    ["Horário", "Fornecedor", "Protocolo", "Tipo", "Status", "Ações", "Trocas", "Observações"],
    [...items].sort((a,b) => String(a.startTime || "").localeCompare(String(b.startTime || "")) || String(a.protocol || "").localeCompare(String(b.protocol || ""))).map(item => `<tr data-appointment-id="${esc(item.id)}"><td>${esc(item.origin === "manual" || !item.endTime ? (item.startTime || "—") : `${item.startTime} - ${item.endTime}`)}</td><td class="cell-primary">${esc(item.supplier)}</td>
      <td>${esc(item.protocol)}</td><td>${esc(item.type || "—")}</td><td>${badge(item.status)}</td>
      <td><div class="inline-actions"><button class="mini-button" type="button" data-appointment-detail="${esc(item.id)}">Detalhes</button>
        ${editable && apiBase.startsWith("/api/admin") ? `<select class="status-select" data-status-select="${esc(item.id)}" aria-label="Status de ${esc(item.supplier)}">
          ${[["aguardando","Aguardando"],["recebido","Recebido"],["nao_chegou","Não recebido"],["recusado","Recusado"]].map(([value,label])=>
            `<option value="${value}" ${item.status===value?"selected":""}>${label}</option>`).join("")}</select>` : ""}
        ${editable ? `<button class="mini-button" data-status="${esc(item.id)}" data-next="recebido" title="Recebido ou Aguardando">✓</button>
          <button class="mini-button" data-status="${esc(item.id)}" data-next="nao_chegou" title="Não recebido ou Aguardando">✕</button>
          ${item.origin === "manual" ? `<button class="mini-button" data-manual-edit="${esc(item.id)}">Editar</button><button class="mini-button" data-manual-remove="${esc(item.id)}">Excluir</button>` : ""}` : ""}
      </div></td>
      <td>${editable ? `<input type="checkbox" aria-label="Trocas ${esc(item.supplier)}" data-exchange="${esc(item.id)}" ${item.hasExchanges ? "checked" : ""}>` : (item.hasExchanges ? "Sim" : "Não")}</td>
      <td class="detail-line">${esc(item.observation || "—")}</td>
      </tr>`)
  );
  const bindAppointmentDetails = (items, apiBase, scope = root) => {
    const host = $("#appointment-details", scope);
    if (!host) return;
    $$("[data-appointment-detail]", scope).forEach(button => button.onclick = async () => {
      const item = items.find(a => a.id === button.dataset.appointmentDetail);
      if (!item) return;
      const requestToken = state.appointmentDetailSeq = (state.appointmentDetailSeq || 0) + 1;
      host.innerHTML = '<p class="loading" role="status">Carregando detalhes…</p>';
      try {
        const store = apiBase.startsWith("/api/store");
        const detail = store ? await api(`/api/store/appointments/${encodeURIComponent(item.id)}`) : item;
        const history = store ? detail.history : state.user?.papel === "visualizador" ? [] :
          await api(`/api/admin/appointments/${encodeURIComponent(item.id)}/history`);
        if (state.appointmentDetailSeq !== requestToken || !host.isConnected) return;
        const fields = [["Horário", [detail.startTime, detail.endTime].filter(Boolean).join(" – ")],
          ["Protocolo", detail.protocol], ["Status", statusLabel(detail.status)], ["Tipo", detail.type],
          ["Itens", detail.items], ["Volumes", detail.volumes], ["Paletes", detail.pallets],
          ["Carga batida", detail.cargaBatida], ["Trocas", detail.hasExchanges ? "Sim" : "Não"],
          ["Observação", detail.observation]];
        host.innerHTML = `<section class="appointment-detail" aria-label="Detalhes do agendamento">
          <div class="detail-heading"><div><h3>${esc(detail.supplier)}</h3><small>Detalhes do fornecedor e histórico de status</small></div>
            <button type="button" class="secondary" data-detail-close>Fechar</button></div>
          <dl class="appointment-detail-grid">${fields.map(([label,value])=>
            `<div><dt>${esc(label)}</dt><dd>${esc(value === null || value === undefined || value === "" ? "—" : value)}</dd></div>`).join("")}</dl>
          <div class="document-fields"><div><strong>NF-e</strong><p>${(detail.nfe || []).map(esc).join(", ") || "Nenhuma NF-e"}</p></div>
          <div><strong>Pedidos</strong><p>${(detail.orders || []).map(esc).join(", ") || "Nenhum pedido"}</p></div></div>
          <h4>Histórico de status</h4>${renderHistory(history, esc, "status")}</section>`;
        $("[data-detail-close]", host).onclick = () => { state.appointmentDetailSeq++; host.replaceChildren(); };
      } catch (error) {
        if (state.appointmentDetailSeq === requestToken && host.isConnected)
          host.innerHTML = `<p role="alert" class="history-error">${esc(error.message || "Não foi possível consultar o histórico.")}</p>`;
      }
    });
  };
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
    $$("[data-status-select]").forEach(select => select.onchange = e => {
      const item = items.find(a => a.id === select.dataset.statusSelect);
      if (!item) return;
      const desired = e.target.value;
      if (desired === item.status) return;
      if (desired === "nao_chegou") {
        modal("Motivo do não recebimento",
          '<label class="field">Observação obrigatória<textarea name="observation" required maxlength="240" rows="4" placeholder="Descreva o motivo"></textarea></label>',
          "Salvar", async data => {
            if (!data.observation.trim()) throw Error("Informe o motivo.");
            await json("PATCH", `${base}/${encodeURIComponent(item.id)}/status`, {status:desired,observation:data.observation.trim()});
            if (!await refreshDetailDialog()) await navigate();
            tell("Status e motivo atualizados.");
          });
      } else asyncAction(() => updateStatus(item.id, desired, base));
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
    state.detailSearch = "";
    state.detailOpener = opener;
    await showAgendaDetail();
  };
  const showAgendaDetail = async () => {
    const { agenda, appointments } = state.detail;
    const editable = state.user.papel === "admin" && state.edit;
    const body = heading("Agenda da loja", `${agenda.storeCode} · ${agenda.storeName}`, `Data: ${dt(agenda.date)} · ${statusLabel(agenda.dayStatus)}`,
      `${state.user.papel === "admin" ? `<button class="secondary" id="edit-agenda">${state.edit ? "Sair da edição" : "Modo editar"}</button>` : ""}
       <button class="icon-button" id="agenda-back" type="button" aria-label="Fechar agenda">×</button>`) +
      (state.user.papel === "admin" && agenda.dayStatus === "concluido" ? `<button class="secondary" id="reopen">Reabrir agenda</button>` : "") +
      (editable && agenda.dayStatus === "concluido" ? `<p class="alert">Modo editar em agenda concluída: os ajustes ficam registrados no histórico.</p>` : "") +
      (editable ? `<div class="toolbar"><button class="secondary" id="add-to-agenda">Adicionar fornecedor sem agenda</button></div>` : "") +
      `<div class="appointment-toolbar"><label class="field search">Pesquisar fornecedor ou protocolo
        <input type="search" id="agenda-search" value="${esc(state.detailSearch || "")}" placeholder="Pesquisar fornecedor ou protocolo"></label>
        ${state.user.papel === "admin" ? `<button type="button" class="secondary" id="agenda-history-toggle" aria-expanded="false">Ver histórico do dia</button>` : ""}</div>` +
      `<div id="agenda-history-content" class="agenda-history-box" hidden></div>` +
      panel("Agendamentos", `${fmt(appointments.length)} fornecedores`,
        `<div id="agenda-table-host"></div><div id="appointment-details"></div>`);

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
    const renderFiltered = () => {
      const filtered = filterAppointments(appointments, state.detailSearch || "");
      $("#agenda-table-host", content).innerHTML = listAppointments(filtered, "/api/admin/appointments", editable);
      if (editable) bindAppointments(filtered, "/api/admin/appointments");
      bindAppointmentDetails(filtered, "/api/admin/appointments", content);
    };
    $("#agenda-search", content).oninput = event => {
      state.detailSearch = event.target.value;
      state.appointmentDetailSeq = (state.appointmentDetailSeq || 0) + 1;
      $("#appointment-details", content).replaceChildren();
      renderFiltered();
    };
    renderFiltered();
    const dayButton = $("#agenda-history-toggle", content);
    const dayBox = $("#agenda-history-content", content);
    if (dayButton) dayButton.onclick = async () => {
      dayBox.hidden = !dayBox.hidden;
      dayButton.textContent = dayBox.hidden ? "Ver histórico do dia" : "Ocultar histórico do dia";
      dayButton.setAttribute("aria-expanded", String(!dayBox.hidden));
      if (dayBox.hidden || dayBox.dataset.loaded === "true") return;
      dayBox.innerHTML = '<p class="loading" role="status">Carregando histórico…</p>';
      dayButton.disabled = true;
      try {
        const rows = await api(`/api/admin/agendas/${encodeURIComponent(agenda.id)}/history`);
        if (!dayBox.isConnected) return;
        dayBox.innerHTML = renderHistory(rows, esc);
        dayBox.dataset.loaded = "true";
      } catch(error) {
        if (dayBox.isConnected) dayBox.innerHTML = `<p class="history-error" role="alert">${esc(error.message || "Não foi possível carregar o histórico.")}</p>`;
      } finally { dayButton.disabled = false; }
    };
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
  return { openAgenda, refreshDetailDialog, manualDialog, listAppointments, bindAppointments, bindAppointmentDetails };
}