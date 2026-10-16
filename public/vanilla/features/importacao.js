// Importação CSV/PDF — modal da administração.
export function openImportDialog(ctx, opener = document.activeElement) {
    const { state, root, shell, $, $$, api, json, asyncAction, navigate, tell, esc, fmt, stats, panel, table } = ctx;
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
        const tools = await import("../parseAgendaBatch.js");
        const pdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
        if (!pdf && !file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") throw Error("Selecione um CSV ou PDF.");
        const text = pdf ? await (await import("../extractPdfText.js")).extractPdfText(file) : await file.text();
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
