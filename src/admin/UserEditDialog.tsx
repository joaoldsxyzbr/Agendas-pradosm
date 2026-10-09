import { useState, type FormEvent } from "react";
import type { UserRole } from "../../shared/auth";
import { ApiError, apiFetch } from "../lib/api";
import { AuditTrail } from "./AuditTrail";
import type { AdminStore, AdminUser } from "./types";

type UserEditDialogProps = {
  user: AdminUser;
  stores: AdminStore[];
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
};

export function UserEditDialog({
  user,
  stores,
  onClose,
  onSaved,
}: UserEditDialogProps) {
  const [nome, setNome] = useState(user.nome);
  const [login, setLogin] = useState(user.login);
  const [papel, setPapel] = useState<UserRole>(user.papel);
  const [lojaId, setLojaId] = useState(user.lojaId ?? "");
  const [senha, setSenha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);

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
          papel,
          ...(papel === "conferente" ? { lojaId } : {}),
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

  async function toggleUserStatus() {
    setSaving(true);
    setMessage(null);

    try {
      const updated = await apiFetch<AdminUser>("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ativo: !user.ativo }),
      });
      onSaved(updated);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível alterar o acesso do usuário.",
      );
      setSaving(false);
      setConfirmToggle(false);
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
            disabled={saving}
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
              <span>Papel</span>
              <select
                value={papel}
                onChange={(event) => setPapel(event.target.value as UserRole)}
              >
                <option value="admin">Administrador</option>
                <option value="conferente">Conferente</option>
                <option value="visualizador">Visualizador</option>
              </select>
            </label>
            {papel === "conferente" ? (
              <label>
                <span>Loja</span>
                <select
                  value={lojaId}
                  onChange={(event) => setLojaId(event.target.value)}
                  required
                >
                  <option value="">Selecione</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.codigo} - {store.nome}
                      {store.ativo ? "" : " (inativa)"}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="modal-wide-field">
              <span>Nova senha (opcional)</span>
              <input
                type="password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                minLength={12}
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
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>

        <AuditTrail entity="usuario" entityId={user.id} />

        <div className="modal-danger-zone">
          {!confirmToggle ? (
            <>
              <div>
                <strong>{user.ativo ? "Desativar usuário" : "Ativar usuário"}</strong>
                <span>
                  {user.ativo
                    ? "Bloqueia o acesso sem apagar agendas ou histórico."
                    : "Restaura o acesso e a visibilidade da loja no dashboard."}
                </span>
              </div>
              <button
                className={user.ativo ? "danger-button" : "primary-button"}
                type="button"
                onClick={() => setConfirmToggle(true)}
                disabled={saving}
              >
                {user.ativo ? "Desativar usuário" : "Ativar usuário"}
              </button>
            </>
          ) : (
            <>
              <div>
                <strong>
                  {user.ativo ? `Desativar ${user.nome}?` : `Ativar ${user.nome}?`}
                </strong>
                <span>
                  {user.ativo
                    ? "O acesso será bloqueado, mas o usuário continuará cadastrado."
                    : "O usuário poderá acessar novamente com sua senha atual."}
                </span>
              </div>
              <div className="confirm-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => setConfirmToggle(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  className={user.ativo ? "danger-button" : "primary-button"}
                  type="button"
                  onClick={() => void toggleUserStatus()}
                  disabled={saving}
                >
                  {saving
                    ? "Salvando..."
                    : user.ativo
                      ? "Confirmar desativação"
                      : "Confirmar ativação"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
