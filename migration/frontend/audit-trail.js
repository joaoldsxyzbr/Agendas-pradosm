import { ApiError, apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";

const LABELS = {
  usuario_criado: "Usuário criado", usuario_atualizado: "Usuário atualizado",
  usuario_removido: "Usuário removido", loja_criada: "Loja criada",
  loja_atualizada: "Loja atualizada", loja_removida: "Loja removida",
  admin_bootstrap_preparado: "Administrador preparado"
};

function dateBR(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short"
  }).format(new Date(value));
}

export function compactAuditValue(value) {
  if (!value || typeof value !== "object") return null;
  return Object.entries(value).map(([key, entry]) => {
    if (key === "senhaAlterada") return entry ? "senha alterada" : null;
    const label = {
      nome: "nome", login: "login", codigo: "código",
      ativo: "status", lojaId: "loja"
    }[key] || key;
    return `${label}: ${typeof entry === "boolean" ? (entry ? "sim" : "não") : String(entry ?? "-")}`;
  }).filter(Boolean).join(" · ");
}

function row(item) {
  const label = LABELS[item.action] ?? String(item.action || "").replaceAll("_", " ");
  return `<li data-audit-id="${escapeHtml(item.id)}">
    <strong>${escapeHtml(label)}</strong>
    <span>${escapeHtml(item.user?.name ?? "Sistema")} · ${escapeHtml(dateBR(item.createdAt))}</span>
    ${item.details ? `<span>${escapeHtml(item.details)}</span>` : ""}
    ${item.before ? `<span>Antes: ${escapeHtml(compactAuditValue(item.before))}</span>` : ""}
    ${item.after ? `<span>Depois: ${escapeHtml(compactAuditValue(item.after))}</span>` : ""}
  </li>`;
}

export function auditTrailHtml() {
  return `<section class="history-box audit-trail" data-audit-trail>
    <div class="history-days-heading">
      <div><strong>Histórico de alterações</strong><span>Auditoria deste cadastro</span></div>
      <button class="ghost-button" type="button" data-audit-toggle>Ver histórico</button>
    </div>
    <div data-audit-items></div>
  </section>`;
}

// Carregamento sob demanda e memoizado como AuditTrail.tsx da main.
export function mountAuditTrail(container, {
  request = apiFetch, entity, entityId
} = {}) {
  let open = false, loaded = false, loading = false, disposed = false;
  let items = [], error = null;
  const content = container.querySelector("[data-audit-items]");
  const button = container.querySelector("[data-audit-toggle]");
  const draw = () => {
    if (disposed) return;
    button.textContent = open ? "Ocultar histórico" : "Ver histórico";
    if (!open) { content.replaceChildren(); return; }
    if (loading) { content.textContent = "Carregando histórico..."; return; }
    if (error) {
      content.innerHTML = `<p class="form-error" role="alert">${escapeHtml(error)}</p>`;
      return;
    }
    content.innerHTML = items.length
      ? `<ul>${items.map(row).join("")}</ul>`
      : "<p>Nenhuma alteração registrada.</p>";
  };
  const toggle = async () => {
    open = !open;
    draw();
    if (!open || loaded || loading) return;
    loading = true; error = null; draw();
    try {
      const params = new URLSearchParams({ entity, entityId });
      items = await request(`/api/admin/audit?${params}`);
      if (!disposed) loaded = true;
    } catch (cause) {
      if (!disposed) error = cause instanceof ApiError
        ? cause.message : "Não foi possível carregar o histórico.";
    } finally {
      loading = false;
      draw();
    }
  };
  button.addEventListener("click", toggle);
  return () => {
    disposed = true;
    button.removeEventListener("click", toggle);
  };
}
