import { useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AdminStore } from "./types";

type StoreEditDialogProps = {
  store: AdminStore;
  onClose: () => void;
  onSaved: (store: AdminStore) => void;
  onDeleted: (storeId: string) => void;
};

export function StoreEditDialog({
  store,
  onClose,
  onSaved,
  onDeleted,
}: StoreEditDialogProps) {
  const [codigo, setCodigo] = useState(store.codigo);
  const [nome, setNome] = useState(store.nome);
  const [ativo, setAtivo] = useState(store.ativo);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updated = await apiFetch<AdminStore>("/api/admin/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: store.id,
          codigo: codigo.trim().toUpperCase(),
          nome: nome.trim(),
          ativo,
        }),
      });
      onSaved(updated);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível atualizar a loja.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeStore() {
    setDeleting(true);
    setMessage(null);

    try {
      await apiFetch<void>(`/api/admin/stores/${store.id}`, {
        method: "DELETE",
      });
      onDeleted(store.id);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível excluir a loja.",
      );
      setDeleting(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-store-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Gerenciar loja</span>
            <h2 id="edit-store-title">Editar loja</h2>
          </div>
          <button
            className="ghost-button"
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
          >
            Fechar
          </button>
        </div>

        <form className="modal-form" onSubmit={save}>
          <div className="modal-form-grid">
            <label>
              <span>Código</span>
              <input
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
                pattern="[Ff][0-9]{1,4}"
                required
              />
            </label>
            <label>
              <span>Nome</span>
              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label className="modal-wide-field">
              <span>Status</span>
              <select
                value={ativo ? "ativo" : "inativo"}
                onChange={(event) => setAtivo(event.target.value === "ativo")}
              >
                <option value="ativo">Ativa</option>
                <option value="inativo">Inativa</option>
              </select>
            </label>
          </div>

          {message ? (
            <p className="form-error" role="alert">
              {message}
            </p>
          ) : null}

          <div className="modal-actions">
            <button
              className="primary-button"
              type="submit"
              disabled={saving || deleting}
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>

        <div className="modal-danger-zone">
          {!confirmDelete ? (
            <>
              <div>
                <strong>Excluir loja</strong>
                <span>Preserva agendas e histórico já registrados.</span>
              </div>
              <button
                className="danger-button"
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
              >
                Excluir loja
              </button>
            </>
          ) : (
            <>
              <div>
                <strong>{`Excluir ${store.codigo} - ${store.nome}?`}</strong>
                <span>
                  A exclusão será bloqueada enquanto houver usuários vinculados.
                </span>
              </div>
              <div className="confirm-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                >
                  Cancelar
                </button>
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => void removeStore()}
                  disabled={deleting}
                >
                  {deleting ? "Excluindo..." : "Confirmar exclusão"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
