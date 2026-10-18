import { ApiError, apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";
import { auditTrailHtml, mountAuditTrail } from "./audit-trail.js";

function storeOptions(stores, selected = "", editing = false) {
  const choices = editing ? stores : stores.filter(store => store.ativo);
  return '<option value="">Selecione</option>' +
    choices.map(store => `<option value="${escapeHtml(store.id)}" ${store.id === selected ? "selected" : ""}>
      ${escapeHtml(`${store.codigo} - ${store.nome}${editing && !store.ativo ? " (inativa)" : ""}`)}
    </option>`).join("");
}

function storeInput(stores, selected, editing) {
  return `<label ${editing ? "" : 'class="modal-wide-field"'} data-user-store-label>
    <span>Loja</span>
    <select name="lojaId" required>${storeOptions(stores, selected, editing)}</select>
  </label>`;
}

function createMarkup(stores) {
  return `<div class="modal-backdrop" data-user-modal>
    <section class="modal-card registry-create-modal" role="dialog"
      aria-modal="true" aria-labelledby="create-user-title">
      <div class="modal-heading"><div>
        <span class="eyebrow">Novo acesso</span><h2 id="create-user-title">Cadastrar usuário</h2>
      </div><button class="ghost-button" type="button" data-user-close>Fechar</button></div>
      <form class="modal-form" data-user-save>
        <div class="modal-form-grid">
          <label><span>Nome</span><input name="nome" required></label>
          <label><span>Login</span><input name="login" required></label>
          <label><span>Senha</span><input type="password" name="senha"
            minlength="12" autocomplete="new-password" required></label>
          <label><span>Papel</span><select name="papel">
            <option value="admin">Administrador</option>
            <option value="conferente" selected>Conferente</option>
            <option value="visualizador">Visualizador</option>
          </select></label>
          ${storeInput(stores, "", false)}
        </div>
        <p class="form-error" role="alert" data-user-error hidden></p>
        <div class="modal-actions">
          <button class="ghost-button" type="button" data-user-close>Cancelar</button>
          <button class="primary-button" type="submit" data-user-submit>Cadastrar usuário</button>
        </div>
      </form>
    </section>
  </div>`;
}

function editMarkup(user, stores) {
  return `<div class="modal-backdrop" data-user-modal>
    <section class="modal-card" role="dialog"
      aria-modal="true" aria-labelledby="edit-user-title">
      <div class="modal-heading"><div>
        <span class="eyebrow">Gerenciar acesso</span><h2 id="edit-user-title">Editar usuário</h2>
      </div><button class="ghost-button" type="button" data-user-close>Fechar</button></div>
      <form class="modal-form" data-user-save>
        <div class="modal-form-grid">
          <label><span>Nome</span><input name="nome" value="${escapeHtml(user.nome)}" required></label>
          <label><span>Login</span><input name="login" value="${escapeHtml(user.login)}" required></label>
          <label><span>Papel</span><select name="papel">
            <option value="admin" ${user.papel === "admin" ? "selected" : ""}>Administrador</option>
            <option value="conferente" ${user.papel === "conferente" ? "selected" : ""}>Conferente</option>
            <option value="visualizador" ${user.papel === "visualizador" ? "selected" : ""}>Visualizador</option>
          </select></label>
          ${user.papel === "conferente" ? storeInput(stores, user.lojaId || "", true) : ""}
          <label class="modal-wide-field"><span>Nova senha (opcional)</span>
            <input type="password" name="senha" minlength="12" autocomplete="new-password"></label>
        </div>
        <p class="form-error" role="alert" data-user-error hidden></p>
        <div class="modal-actions">
          <button class="primary-button" type="submit" data-user-submit>Salvar alterações</button>
        </div>
      </form>
      ${auditTrailHtml()}
      <div class="modal-danger-zone" data-user-status-zone>
        <div><strong>${user.ativo ? "Desativar usuário" : "Ativar usuário"}</strong>
          <span>${user.ativo
            ? "Bloqueia o acesso sem apagar agendas ou histórico."
            : "Restaura o acesso e a visibilidade da loja no dashboard."}</span>
        </div>
        <button class="${user.ativo ? "danger-button" : "primary-button"}"
          type="button" data-user-toggle-start>${user.ativo ? "Desativar usuário" : "Ativar usuário"}</button>
      </div>
    </section>
  </div>`;
}

export function buildUserPayload(form, user = null) {
  const papel = form.elements.namedItem("papel").value;
  const senha = form.elements.namedItem("senha").value;
  const payload = {
    ...(user ? { id: user.id } : {}),
    nome: form.elements.namedItem("nome").value.trim(),
    login: form.elements.namedItem("login").value.trim(),
    papel,
    ...(papel === "conferente" ? {
      lojaId: form.elements.namedItem("lojaId").value
    } : {}),
    ...(!user || senha ? { senha } : {})
  };
  return payload;
}

export function openUserDialog(root, {
  user = null, stores = [], request = apiFetch,
  onSaved = () => {}, onClose = () => {}
} = {}) {
  let disposed = false, saving = false, auditingOff = () => {};
  let previousStoreId = user?.lojaId || "";
  root.insertAdjacentHTML("beforeend", user ? editMarkup(user, stores) : createMarkup(stores));
  const modal = root.querySelector("[data-user-modal]");
  const form = modal.querySelector("[data-user-save]");
  form.elements.namedItem("nome").focus();

  const error = message => {
    const node = modal.querySelector("[data-user-error]");
    node.textContent = message || "";
    node.hidden = !message;
  };
  const close = () => {
    if (disposed) return;
    disposed = true;
    auditingOff();
    modal.remove();
    onClose();
  };
  if (user) {
    auditingOff = mountAuditTrail(modal, {
      request, entity: "usuario", entityId: user.id
    });
  }
  const roleChange = event => {
    if (!event.target.matches('select[name="papel"]')) return;
    const holder = form.querySelector(".modal-form-grid");
    const existing = holder.querySelector("[data-user-store-label]");
    if (existing) {
      previousStoreId = existing.querySelector("select").value;
      existing.remove();
    }
    if (event.target.value === "conferente") {
      const reference = user ? holder.querySelector(".modal-wide-field") : null;
      const temp = modal.ownerDocument.createElement("template");
      temp.innerHTML = storeInput(stores, previousStoreId, Boolean(user));
      if (reference) holder.insertBefore(temp.content, reference);
      else holder.appendChild(temp.content);
    }
  };
  form.addEventListener("change", roleChange);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    error(null);
    const button = form.querySelector("[data-user-submit]");
    button.disabled = true;
    button.textContent = "Salvando...";
    try {
      const updated = await request("/api/admin/users", {
        method: user ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildUserPayload(form, user))
      });
      if (disposed) return;
      await onSaved(updated);
      close();
    } catch (cause) {
      if (!disposed) error(cause instanceof ApiError ? cause.message
        : user ? "Não foi possível atualizar o usuário." : "Não foi possível cadastrar o usuário.");
    } finally {
      saving = false;
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = user ? "Salvar alterações" : "Cadastrar usuário";
      }
    }
  });

  const confirmMarkup = () => `<div>
    <strong>${escapeHtml(user.ativo ? `Desativar ${user.nome}?` : `Ativar ${user.nome}?`)}</strong>
    <span>${user.ativo
      ? "O acesso será bloqueado, mas o usuário continuará cadastrado."
      : "O usuário poderá acessar novamente com sua senha atual."}</span>
    </div>
    <div class="confirm-actions">
      <button class="ghost-button" type="button" data-user-toggle-cancel>Cancelar</button>
      <button class="${user.ativo ? "danger-button" : "primary-button"}" type="button"
        data-user-toggle-confirm>${user.ativo ? "Confirmar desativação" : "Confirmar ativação"}</button>
    </div>`;

  const onClick = async event => {
    const button = event.target.closest?.("button");
    if (!button || !modal.contains(button) || saving) return;
    if (button.matches("[data-user-close]")) { close(); return; }
    if (!user) return;
    const zone = modal.querySelector("[data-user-status-zone]");
    if (button.matches("[data-user-toggle-start]")) {
      zone.innerHTML = confirmMarkup();
    } else if (button.matches("[data-user-toggle-cancel]")) {
      zone.innerHTML = `<div>
        <strong>${user.ativo ? "Desativar usuário" : "Ativar usuário"}</strong>
        <span>${user.ativo
          ? "Bloqueia o acesso sem apagar agendas ou histórico."
          : "Restaura o acesso e a visibilidade da loja no dashboard."}</span>
      </div>
      <button class="${user.ativo ? "danger-button" : "primary-button"}" type="button"
        data-user-toggle-start>${user.ativo ? "Desativar usuário" : "Ativar usuário"}</button>`;
    } else if (button.matches("[data-user-toggle-confirm]")) {
      saving = true;
      button.disabled = true;
      button.textContent = "Salvando...";
      error(null);
      try {
        const updated = await request("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: user.id, ativo: !user.ativo })
        });
        if (disposed) return;
        await onSaved(updated);
        close();
      } catch (cause) {
        if (!disposed) error(cause instanceof ApiError
          ? cause.message : "Não foi possível alterar o acesso do usuário.");
      } finally {
        saving = false;
        if (button.isConnected) {
          button.disabled = false;
          button.textContent = user.ativo ? "Confirmar desativação" : "Confirmar ativação";
        }
      }
    }
  };
  modal.addEventListener("click", onClick);
  return close;
}
