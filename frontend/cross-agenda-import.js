import { apiFetch, ApiError } from "./api.js";
import { escapeHtml } from "./shell.js";
import { activateModal } from "./dialog-focus.js";
import { extractPdfText } from "./import/extractPdfText.js";
import { parseCrossReport } from "./import/parseCrossReport.js";
import { previewHtml } from "./cross.js";
import { sortAgendaAppointments } from "./agenda-list.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const formatDate = date => String(date ?? "").split("-").reverse().join("/");
const validPdfFile = file => file && file.size > 0 && file.size <= MAX_FILE_SIZE &&
  /\.pdf$/i.test(file.name) && (!file.type || file.type === "application/pdf");

const messageFromError = error => {
  const code = error instanceof ApiError ? error.code : error?.code;
  if (code === "CROSS_DUPLICADO") return "Este PDF já foi importado para este fornecedor. Confira o histórico.";
  if (code === "CROSS_JA_VINCULADO" || code === "CROSS_VERSAO_DESATUALIZADA" ||
      code === "CROSS_CONFLITO_CONCORRENTE") return "Este fornecedor teve o Cross atualizado. Confira a versão ativa antes de tentar novamente.";
  if (code === "AGENDA_CONCLUIDA") return "A agenda foi concluída. Não é possível importar outro Cross.";
  if (code === "AGENDAMENTO_NAO_ENCONTRADO") return "O agendamento foi alterado ou removido. Reabra a agenda.";
  if (code === "DATA_AGENDA_DIVERGENTE") return "A data operacional precisa ser a mesma da agenda.";
  return "Não foi possível importar. Confira o arquivo ou tente novamente.";
};

/**
 * P2: importação contextual na agenda do ADM. Não modifica status de
 * recebimento, agendas ou o leitor PDF utilizado pelos outros fluxos.
 */
export function openCrossAgendaImport(root, {
  agenda, appointments = [], request = apiFetch, onImported = () => {}, onClose = () => {},
  extractText = extractPdfText, parseReport = parseCrossReport
} = {}) {
  if (agenda?.storeCode?.trim().toUpperCase() !== "CD DOCA 01") return () => {};
  const document = root.ownerDocument;
  const choices = sortAgendaAppointments(appointments.filter(item => item?.ativo !== false));
  const host = document.createElement("div");
  host.className = "cross-agenda-import-host";
  host.innerHTML = `<div class="modal-backdrop cross-backdrop" data-cross-agenda-backdrop>
    <section class="modal-card cross-modal cross-agenda-modal" role="dialog" aria-modal="true"
      aria-labelledby="cross-agenda-title" tabindex="-1">
      <header class="cross-detail-heading">
        <div><span class="eyebrow">CD Doca 01 · ${escapeHtml(formatDate(agenda.date))}</span>
          <h2 id="cross-agenda-title">Importar Cross</h2></div>
        <button class="ghost-button" type="button" data-cross-agenda-close>Fechar</button>
      </header>
      <p class="muted-state">Escolha o agendamento correto. O Cross ficará vinculado ao protocolo, não apenas ao nome do fornecedor.</p>
      <form data-cross-agenda-form>
        <div class="cross-form">
          <label>Fornecedor / agendamento
            <select required data-cross-agenda-appointment>
              <option value="">Selecione o fornecedor e protocolo</option>
              ${choices.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.startTime || "Sem horário")} ·
                ${escapeHtml(item.supplier)} · Protocolo ${escapeHtml(item.protocol || "Sem agenda")}</option>`).join("")}
            </select>
          </label>
          <label>Relatório Cross (PDF)
            <input type="file" accept=".pdf,application/pdf" data-cross-agenda-file>
          </label>
        </div>
        <div class="cross-agenda-existing" data-cross-agenda-existing hidden>
          <p class="muted-state" data-cross-agenda-version></p>
          <label class="cross-agenda-check"><input type="checkbox" data-cross-agenda-replace>
            Substituir o Cross ativo deste agendamento (a versão anterior será preservada)</label>
        </div>
        <div class="cross-agenda-existing" data-cross-agenda-mismatch hidden>
          <p class="form-error">A data do PDF é diferente da data da agenda. Verifique se este Cross pertence mesmo à carga.</p>
          <label class="cross-agenda-check"><input type="checkbox" data-cross-agenda-ack>
            Confirmei que este PDF corresponde ao agendamento selecionado</label>
        </div>
        <div data-cross-agenda-status role="status" aria-live="polite" class="muted-state">Consultando os Cross já importados...</div>
        <div data-cross-agenda-preview></div>
        <div class="cross-actions">
          <button class="ghost-button" type="button" data-cross-agenda-cancel>Cancelar</button>
          <button class="primary-button" type="submit" data-cross-agenda-submit disabled>Confirmar importação</button>
        </div>
      </form>
    </section>
  </div>`;
  root.append(host);

  let disposed = false, loading = true, busy = false, available = false;
  let selectedId = "", file = null, parsed = null, readToken = 0;
  let reportsByAppointment = new Map();
  const $ = selector => host.querySelector(selector);
  const dialog = $('[role="dialog"]');
  const selector = $('[data-cross-agenda-appointment]');
  const fileInput = $('[data-cross-agenda-file]');
  const replaceCheckbox = $('[data-cross-agenda-replace]');
  const ackCheckbox = $('[data-cross-agenda-ack]');
  const submit = $('[data-cross-agenda-submit]');
  const status = $('[data-cross-agenda-status]');
  const preview = $('[data-cross-agenda-preview]');

  let releaseFocus = () => {};
  const close = () => {
    if (disposed) return;
    disposed = true;
    readToken++;
    releaseFocus();
    host.remove();
    onClose();
  };

  const setStatus = (text, kind = "info") => {
    status.textContent = text;
    status.className = kind === "error" ? "form-error" :
      kind === "success" ? "success-message" : "muted-state";
  };

  const active = () => reportsByAppointment.get(selectedId) || null;
  const reportDateMismatch = () => parsed?.reportDate && parsed.reportDate !== agenda.date;
  const refreshControls = () => {
    if (disposed) return;
    const current = active();
    const existing = $('[data-cross-agenda-existing]');
    existing.hidden = !current;
    $('[data-cross-agenda-version]').textContent = current
      ? `Já existe Cross ativo (versão ${current.version}) — ${current.fileName}. Para substituir, confirme abaixo.` : "";
    if (!current) replaceCheckbox.checked = false;

    const mismatch = $('[data-cross-agenda-mismatch]');
    mismatch.hidden = !reportDateMismatch();
    if (mismatch.hidden) ackCheckbox.checked = false;
    selector.disabled = busy || loading || !available || !choices.length;
    fileInput.disabled = busy || loading || !available || !choices.length;
    replaceCheckbox.disabled = busy;
    ackCheckbox.disabled = busy;
    submit.disabled = loading || busy || !available || !selectedId || !file ||
      !parsed || parsed.errors.length > 0 ||
      (Boolean(current) && !replaceCheckbox.checked) ||
      (Boolean(reportDateMismatch()) && !ackCheckbox.checked);
    submit.textContent = busy ? "Importando..." : current ? "Confirmar substituição" : "Confirmar importação";
  };

  const reloadExisting = async () => {
    loading = true;
    available = false;
    refreshControls();
    try {
      const result = await request(`/api/admin/cross/agendas/${encodeURIComponent(agenda.id)}`);
      if (disposed) return;
      reportsByAppointment = new Map((result.suppliers || []).map(entry =>
        [entry.appointment.id, entry.cross]));
      available = true;
      setStatus("Selecione o fornecedor e um PDF para conferir os dados.");
    } catch {
      if (disposed) return;
      setStatus("O Cross está indisponível neste ambiente. Verifique as migrations do D1 de testes.", "error");
    } finally {
      if (!disposed) { loading = false; refreshControls(); }
    }
  };

  const readFile = async nextFile => {
    const token = ++readToken;
    file = null;
    parsed = null;
    preview.replaceChildren();
    ackCheckbox.checked = false;
    if (!nextFile) {
      setStatus("Selecione o PDF Cross.");
      refreshControls();
      return;
    }
    if (!validPdfFile(nextFile)) {
      setStatus("Selecione um PDF válido de até 10 MB.", "error");
      refreshControls();
      return;
    }
    busy = true;
    setStatus("Lendo e conferindo o PDF...");
    refreshControls();
    try {
      const parsedReport = parseReport(await extractText(nextFile));
      if (disposed || token !== readToken) return;
      file = nextFile;
      parsed = parsedReport;
      preview.innerHTML = previewHtml(parsedReport);
      setStatus(parsedReport.errors?.length
        ? "O relatório possui erros e não pode ser importado."
        : "Prévia pronta. Confira o fornecedor e as quantidades antes de confirmar.",
        parsedReport.errors?.length ? "error" : "success");
    } catch {
      if (!disposed && token === readToken) setStatus("Não foi possível ler este PDF. Tente outro arquivo.", "error");
    } finally {
      if (!disposed && token === readToken) { busy = false; refreshControls(); }
    }
  };

  const handleChange = event => {
    if (event.target === selector) {
      selectedId = selector.value;
      replaceCheckbox.checked = false;
      ackCheckbox.checked = false;
      refreshControls();
    } else if (event.target === fileInput) {
      void readFile(fileInput.files?.[0]);
    } else if (event.target === replaceCheckbox || event.target === ackCheckbox) {
      refreshControls();
    }
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (submit.disabled || disposed || busy) return;
    const selected = choices.find(item => item.id === selectedId);
    if (!selected) return;
    const replaceActiveReportId = active()?.id;
    if (replaceActiveReportId && !replaceCheckbox.checked) return;
    const payload = {
      operationalDate: agenda.date,
      reportDate: parsed.reportDate, reportCode: parsed.reportCode,
      fileName: file.name, reference: "",
      declared: {
        lines: parsed.lines, dispatchQty: parsed.dispatchQty,
        separateQty: parsed.separateQty
      },
      rows: parsed.rows
    };
    if (replaceActiveReportId) payload.replaceActiveReportId = replaceActiveReportId;
    busy = true;
    setStatus("Salvando o Cross no agendamento selecionado...");
    refreshControls();
    try {
      const result = await request(
        `/api/admin/cross/agendas/${encodeURIComponent(agenda.id)}/appointments/${encodeURIComponent(selected.id)}`,
        { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload) }
      );
      if (disposed) return;
      onImported({ appointmentId: selected.id, supplier: selected.supplier, report: result });
      close();
    } catch (error) {
      if (disposed) return;
      setStatus(messageFromError(error), "error");
      const code = error instanceof ApiError ? error.code : error?.code;
      if (["CROSS_JA_VINCULADO", "CROSS_VERSAO_DESATUALIZADA",
        "CROSS_CONFLITO_CONCORRENTE"].includes(code)) {
        replaceCheckbox.checked = false;
        await reloadExisting();
        if (!disposed) setStatus("O Cross foi atualizado por outro usuário. Confira a versão e confirme novamente.", "error");
      }
    } finally {
      if (!disposed) { busy = false; refreshControls(); }
    }
  };

  const click = event => {
    if (event.target.closest?.("[data-cross-agenda-close],[data-cross-agenda-cancel]") ||
        event.target === $('[data-cross-agenda-backdrop]')) close();
  };
  host.addEventListener("change", handleChange);
  host.addEventListener("submit", handleSubmit);
  host.addEventListener("click", click);
  releaseFocus = activateModal(dialog, {
    initialFocus: () => selector, trigger: document.activeElement, onEscape: close
  });
  if (!choices.length) setStatus("Não há agendamentos ativos nesta agenda.", "error");
  else void reloadExisting();
  return close;
}
