import { useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AdminStore, AdminUser } from "./types";

type UserEditDialogProps = {
  user: AdminUser;
  stores: AdminStore[];
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
  onDeleted: (userId: string) => void;
};

export function UserEditDialog({
  user,
  stores,
  onClose,
  onSaved,
  onDeleted,
}: UserEditDialogProps) {
  const [nome, setNome] = useState(user.nome);
  const [login, setLogin] = useState(user.login);
  const [lojaId, setLojaId] = useState(user.lojaId);
  const [ativo, setAtivo] = useState(user.ativo);
  const [senha, setSenha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updated = await apiFetch<AdminUser>("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          nome: nome.trim(),
          login: login.trim(),
          lojaId,
          ativo,
          ...(senha ? { senha } : {}),
        }),
      });
      onSaved(updated);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível atualizar o usuário.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeUser() {
    setDeleting(true);
    setMessage(null);

    try {
      await apiFetch<void>(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      onDeleted(user.id);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível excluir o usuário.",
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
        aria-labelledby="edit-user-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Gerenciar acesso</span>
            <h2 id="edit-user-title">Editar usuário</h2>
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
              <span>Nome</span>
              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Login</span>
              <input
                value={login}
                onChange={(event) => setLogin(event.target.value)}
                required
              />
            </label>
            <label>
              <span>Loja</span>
              <select
                value={lojaId}
                onChange={(event) => setLojaId(event.target.value)}
                required
              >
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.codigo} - {store.nome}
                    {store.ativo ? "" : " (inativa)"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={ativo ? "ativo" : "inativo"}
                onChange={(event) => setAtivo(event.target.value === "ativo")}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
            <label className="modal-wide-field">
              <span>Nova senha (opcional)</span>
              <input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                minLength={8}
                autoComplete="new-password"
              />
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
                <strong>Excluir usuário</strong>
                <span>Remove o acesso sem apagar o histórico de auditoria.</span>
              </div>
              <button
                className="danger-button"
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
              >
                Excluir usuário
              </button>
            </>
          ) : (
            <>
              <div>
                <strong>{`Excluir ${user.nome}?`}</strong>
                <span>O usuário perderá o acesso imediatamente.</span>
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
                  onClick={() => void removeUser()}
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
