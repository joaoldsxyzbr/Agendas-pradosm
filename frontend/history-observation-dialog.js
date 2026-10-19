import { escapeHtml } from "./shell.js";
import { OBSERVATION_REASONS, validateStatusObservation } from "../shared/observations.js";

// Mesmo contrato de motivo obrigatório da tela do conferente, no histórico administrativo.
export function openHistoryObservationDialog(root, appointment, { onSave, onClose = () => {} }) {
  const doc = root.ownerDocument;
  const backdrop = doc.createElement("div");
  backdrop.className = "modal-backdrop observation-modal-backdrop";
  backdrop.innerHTML = `<form class="modal-card observation-dialog" role="dialog" aria-modal="true"
    aria-labelledby="history-observation-dialog-title">
    <div class="modal-heading">
      <div><span class="eyebrow">Recebimento</span>
        <h2 id="history-observation-dialog-title">Motivo de não recebimento</h2></div>
      <button class="ghost-button" type="button" data-observation-cancel>Fechar</button>
    </div>
    <p class="observation-dialog-supplier">${escapeHtml(appointment.supplier)}</p>
    <label class="observation-field">Motivo (obrigatório)
      <select data-observation-reason required>
        <option value="">Selecione um motivo</option>
        ${OBSERVATION_REASONS.map(reason => `<option value="${escapeHtml(reason)}">${escapeHtml(reason)}</option>`).join("")}
        <option value="Outros">Outros (personalizado)</option>
      </select>
    </label>
    <label class="observation-field" data-observation-custom-wrap hidden>Descreva o motivo
      <textarea data-observation-custom maxlength="242" rows="3" placeholder="Descreva o motivo"></textarea>
    </label>
    <p class="form-error" role="alert" data-observation-error hidden></p>
    <div class="observation-dialog-actions">
      <button class="ghost-button" type="button" data-observation-cancel>Cancelar</button>
      <button class="primary-button" type="submit" data-observation-save>Confirmar</button>
    </div>
  </form>`;
  const reason = backdrop.querySelector("[data-observation-reason]");
  const custom = backdrop.querySelector("[data-observation-custom]");
  const customWrap = backdrop.querySelector("[data-observation-custom-wrap]");
  const save = backdrop.querySelector("[data-observation-save]");
  const errorBox = backdrop.querySelector("[data-observation-error]");
  let closed = false;
  const onKey = event => {
    if (event.key === "Escape" && !save.disabled) close();
  };
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.remove();
    doc.removeEventListener("keydown", onKey);
    onClose();
  };
  const sync = () => {
    customWrap.hidden = reason.value !== "Outros";
    custom.required = reason.value === "Outros";
  };
  reason.addEventListener("change", sync);
  for (const button of backdrop.querySelectorAll("[data-observation-cancel]"))
    button.addEventListener("click", () => { if (!save.disabled) close(); });
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop && !save.disabled) close();
  });
  backdrop.addEventListener("submit", async event => {
    event.preventDefault();
    errorBox.hidden = true;
    let observation;
    try {
      const input = reason.value === "Outros" ? "Outros: " + custom.value.trim() : reason.value;
      observation = validateStatusObservation("nao_chegou", input);
    } catch (error) {
      errorBox.textContent = error.message;
      errorBox.hidden = false;
      return;
    }
    save.disabled = true;
    let saved = false;
    try { saved = await onSave(observation); } catch { saved = false; }
    if (closed) return;
    if (saved) close();
    else {
      errorBox.textContent = "Não foi possível salvar. Tente novamente.";
      errorBox.hidden = false;
      save.disabled = false;
    }
  });
  doc.addEventListener("keydown", onKey);
  doc.body.appendChild(backdrop);
  reason.focus();
  return close;
}
