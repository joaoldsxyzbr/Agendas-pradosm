import { useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AdminAuditItem } from "./types";

const ACTION_LABELS: Record<string, string> = {
  usuario_criado: "Usuário criado",
  usuario_atualizado: "Usuário atualizado",
  usuario_removido: "Usuário removido",
  loja_criada: "Loja criada",
  loja_atualizada: "Loja atualizada",
  loja_removida: "Loja removida",
  admin_bootstrap_preparado: "Administrador preparado",
};

function formatWhen(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function compactValue(value: unknown) {
  if (!value || typeof value !== "object") return null;

  return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => {
      if (key === "senhaAlterada") {
        return entry ? "senha alterada" : null;
      }
      const label =
        key === "nome"
          ? "nome"
          : key === "login"
            ? "login"
            : key === "codigo"
              ? "código"
              : key === "ativo"
                ? "status"
                : key === "lojaId"
                  ? "loja"
                  : key;
      const shown =
        typeof entry === "boolean" ? (entry ? "sim" : "não") : String(entry ?? "-");
      return `${label}: ${shown}`;
    })
    .filter(Boolean)
    .join(" · ");
}

export function AuditTrail({
  entity,
  entityId,
}: {
  entity: "usuario" | "loja";
  entityId: string;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminAuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }

    setOpen(true);
    if (loaded) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ entity, entityId });
      setItems(
        await apiFetch<AdminAuditItem[]>(
          `/api/admin/audit?${params.toString()}`,
        ),
      );
      setLoaded(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Não foi possível carregar o histórico.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="history-box audit-trail">
      <div className="history-days-heading">
        <div>
          <strong>Histórico de alterações</strong>
          <span>Auditoria deste cadastro</span>
        </div>
        <button className="ghost-button" type="button" onClick={() => void toggle()}>
          {open ? "Ocultar histórico" : "Ver histórico"}
        </button>
      </div>

      {open ? (
        loading ? (
          <p>Carregando histórico...</p>
        ) : error ? (
          <p className="form-error" role="alert">{error}</p>
        ) : items.length ? (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <strong>{ACTION_LABELS[item.action] ?? item.action.replaceAll("_", " ")}</strong>
                <span>
                  {item.user?.name ?? "Sistema"} · {formatWhen(item.createdAt)}
                </span>
                {item.details ? <span>{item.details}</span> : null}
                {item.before ? <span>Antes: {compactValue(item.before)}</span> : null}
                {item.after ? <span>Depois: {compactValue(item.after)}</span> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma alteração registrada.</p>
        )
      ) : null}
    </section>
  );
}
