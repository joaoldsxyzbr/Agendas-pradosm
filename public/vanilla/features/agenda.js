// Detalhes, estados e edição de agendas.
export function createAgendaController(ctx) {
  const { state, root, $, $$, esc, dt, fmt, badge, table, heading, panel, field, statusLabel, modal, json, api, asyncAction, navigate, tell } = ctx;
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
  return { openAgenda, refreshDetailDialog, manualDialog, listAppointments, bindAppointments };
}
