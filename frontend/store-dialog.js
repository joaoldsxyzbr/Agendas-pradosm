import { ApiError, apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";

const ACTION_LABELS = {
  usuario_criado: "Usuário criado", usuario_atualizado: "Usuário atualizado",
  usuario_removido: "Usuário removido", loja_criada: "Loja criada",
  loja_atualizada: "Loja atualizada", loja_removida: "Loja removida",
  admin_bootstrap_preparado: "Administrador preparado"
};
function when(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short"
  }).format(new Date(date));
}
function compact(value) {
  if (!value || typeof value !== "object") return null;
  return Object.entries(value).map(([key, entry]) => {
    if (key === "senhaAlterada") return entry ? "senha alterada" : null;
    const label = { nome: "nome", login: "login", codigo: "código", ativo: "status", lojaId: "loja" }[key] || key;
    const shown = typeof entry === "boolean" ? (entry ? "sim" : "não") : String(entry ?? "-");
    return `${label}: ${shown}`;
  }).filter(Boolean).join(" · ");
}
function auditRow(item) {
  const action = ACTION_LABELS[item.action] ?? String(item.action || "").replaceAll("_", " ");
  return `<li><strong>${escapeHtml(action)}</strong>
    <span>${escapeHtml(item.user?.name ?? "Sistema")} · ${escapeHtml(when(item.createdAt))}</span>
    ${item.details ? `<span>${escapeHtml(item.details)}</span>` : ""}
    ${item.before ? `<span>Antes: ${escapeHtml(compact(item.before))}</span>` : ""}
    ${item.after ? `<span>Depois: ${escapeHtml(compact(item.after))}</span>` : ""}
  </li>`;
}
const heading = (title, label, id) => `<div class="modal-heading">
  <div><span class="eyebrow">${label}</span><h2 id="${id}">${title}</h2></div>
  <button class="ghost-button" type="button" data-close-store>Fechar</button>
</div>`;

function modalMarkup(store) {
  const edit = Boolean(store);
  const title = edit ? "Editar loja" : "Cadastrar loja";
  return `<div class="modal-backdrop" data-store-modal>
    <section class="modal-card${edit ? "" : " registry-create-modal"}" role="dialog"
      aria-modal="true" aria-labelledby="${edit ? "edit-store-title" : "create-store-title"}">
      ${heading(title, edit ? "Gerenciar loja" : "Nova unidade", edit ? "edit-store-title" : "create-store-title")}
      <form class="modal-form" data-save-store>
        <div class="modal-form-grid">
          <label><span>Código</span><input name="codigo" value="${escapeHtml(store?.codigo || "")}"
            ${edit ? "" : 'placeholder="F03 ou CD DOCA 01"'} maxlength="20" required></label>
          <label><span>Nome</span><input name="nome" value="${escapeHtml(store?.nome || "")}" maxlength="120" required></label>
          ${edit ? `<label class="modal-wide-field"><span>Status</span>
            <select name="ativo">
              <option value="ativo" ${store.ativo ? "selected" : ""}>Ativa</option>
              <option value="inativo" ${store.ativo ? "" : "selected"}>Inativa</option>
            </select>
          </label>` : ""}
        </div>
        <p class="form-error" role="alert" data-store-error hidden></p>
        <div class="modal-actions">
          ${edit ? "" : '<button class="ghost-button" type="button" data-close-store>Cancelar</button>'}
          <button class="primary-button" type="submit" data-save-button>${edit ? "Salvar alterações" : "Cadastrar loja"}</button>
        </div>
      </form>
      ${edit ? `<section class="history-box audit-trail">
        <div class="history-days-heading">
          <div><strong>Histórico de alterações</strong><span>Auditoria deste cadastro</span></div>
          <button class="ghost-button" type="button" data-audit-toggle>Ver histórico</button>
        </div>
        <div data-audit-content></div>
      </section>
      <div class="modal-danger-zone" data-store-delete-zone>
        <div><strong>Excluir loja</strong><span>Preserva agendas e histórico já registrados.</span></div>
        <button class="danger-button" type="button" data-delete-start>Excluir loja</button>
      </div>` : ""}
    </section>
  </div>`;
}

// Converte StoreEditDialog e AuditTrail da main em eventos DOM sem React.
export function openStoreDialog(root, {
  store = null, request = apiFetch,
  onSaved = () => {}, onDeleted = () => {}, onClose = () => {}
} = {}) {
  let disposed = false, saving = false, deleting = false;
  let auditOpen = false, auditLoaded = false, auditLoading = false, auditItems = [];
  root.insertAdjacentHTML("beforeend", modalMarkup(store));
  const modal = root.querySelector("[data-store-modal]");
  modal.querySelector("input")?.focus();
  const error = msg => {
    const box = modal.querySelector("[data-store-error]");
    box.textContent = msg || "";
    box.hidden = !msg;
  };

  const close = () => {
    if (saving || deleting || disposed) return;
    disposed = true;
    modal.remove();
    onClose();
  };
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    modal.remove();
    onClose();
  };

  const renderAudit = () => {
    const content = modal.querySelector("[data-audit-content]");
    if (!content) return;
    modal.querySelector("[data-audit-toggle]").textContent =
      auditOpen ? "Ocultar histórico" : "Ver histórico";
    if (!auditOpen) { content.replaceChildren(); return; }
    if (auditLoading) { content.textContent = "Carregando histórico..."; return; }
    content.innerHTML = auditItems.length
      ? `<ul>${auditItems.map(auditRow).join("")}</ul>`
      : "<p>Nenhuma alteração registrada.</p>";
  };
  const auditToggle = async () => {
    auditOpen = !auditOpen;
    renderAudit();
    if (!auditOpen || auditLoaded) return;
    auditLoading = true;
    renderAudit();
    try {
      const params = new URLSearchParams({ entity: "loja", entityId: store.id });
      auditItems = await request(`/api/admin/audit?${params}`);
      if (disposed) return;
      auditLoaded = true;
    } catch (caught) {
      if (!disposed) {
        const content = modal.querySelector("[data-audit-content]");
        if (content) {
          content.textContent = caught instanceof ApiError ? caught.message : "Não foi possível carregar o histórico.";
          content.classList.add("form-error");
          content.setAttribute("role", "alert");
        }
      }
      return;
    } finally { auditLoading = false; }
    renderAudit();
  };

  modal.addEventListener("click", async event => {
    const button = event.target.closest?.("button");
    if (!button || !modal.contains(button)) return;
    if (button.matches("[data-close-store]")) { close(); return; }
    if (button.matches("[data-audit-toggle]")) { await auditToggle(); return; }
    const zone = modal.querySelector("[data-store-delete-zone]");
    if (!zone || saving || deleting) return;
    if (button.matches("[data-delete-start]")) {
      zone.innerHTML = `<div>
        <strong>${escapeHtml(`Excluir ${store.codigo} - ${store.nome}?`)}</strong>
        <span>A exclusão será bloqueada enquanto houver usuários vinculados.</span>
      </div>
      <div class="confirm-actions">
        <button class="ghost-button" type="button" data-delete-cancel>Cancelar</button>
        <button class="danger-button" type="button" data-delete-confirm>Confirmar exclusão</button>
      </div>`;
    } else if (button.matches("[data-delete-cancel]")) {
      zone.innerHTML = `<div><strong>Excluir loja</strong>
        <span>Preserva agendas e histórico já registrados.</span></div>
        <button class="danger-button" type="button" data-delete-start>Excluir loja</button>`;
    } else if (button.matches("[data-delete-confirm]")) {
      deleting = true; button.disabled = true; button.textContent = "Excluindo...";
      error(null);
      try {
        await request(`/api/admin/stores/${encodeURIComponent(store.id)}`, { method: "DELETE" });
        if (disposed) return;
        await onDeleted(store.id);
        cleanup();
      } catch (caught) {
        if (!disposed) error(caught instanceof ApiError ? caught.message : "Não foi possível excluir a loja.");
      } finally {
        deleting = false;
        if (button.isConnected) { button.disabled = false; button.textContent = "Confirmar exclusão"; }
      }
    }
  });
  modal.querySelector("[data-save-store]").addEventListener("submit", async event => {
    event.preventDefault();
    if (saving || deleting) return;
    const form = event.currentTarget;
    const button = form.querySelector("[data-save-button]");
    const payload = {
      codigo: form.elements.namedItem("codigo").value.trim().toUpperCase(),
      nome: form.elements.namedItem("nome").value.trim()
    };
    if (store) {
      payload.id = store.id;
      payload.ativo = form.elements.namedItem("ativo").value === "ativo";
    }
    saving = true; error(null); button.disabled = true; button.textContent = "Salvando...";
    try {
      const updated = await request("/api/admin/stores", {
        method: store ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (disposed) return;
      await onSaved(updated);
      cleanup();
    } catch (caught) {
      if (!disposed) error(caught instanceof ApiError ? caught.message
        : store ? "Não foi possível atualizar a loja." : "Não foi possível cadastrar a loja.");
    } finally {
      saving = false;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = store ? "Salvar alterações" : "Cadastrar loja";
      }
    }
  });
  return cleanup;
}