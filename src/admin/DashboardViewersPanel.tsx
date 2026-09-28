import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../lib/api";

type DashboardViewer = {
  id: string;
  nome: string;
  login: string;
  perfil: "visualizador";
  lojaId: null;
  ativo: boolean;
};

export function DashboardViewersPanel() {
  const [viewers, setViewers] = useState<DashboardViewer[]>([]);
  const [selected, setSelected] = useState<DashboardViewer | null>(null);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setViewers(await apiFetch<DashboardViewer[]>("/api/admin/viewers"));
  }

  useEffect(() => {
    void load().catch(() =>
      setMessage("Não foi possível carregar os visualizadores."),
    );
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await apiFetch<DashboardViewer>("/api/admin/viewers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          login: login.trim(),
          senha,
        }),
      });
      setNome("");
      setLogin("");
      setSenha("");
      setMessage("Visualizador cadastrado com sucesso.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível cadastrar o visualizador.",
      );
    } finally {
      setSaving(false);
    }
  }

  function saved(updated: DashboardViewer) {
    setViewers((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setSelected(null);
    setMessage("Visualizador atualizado com sucesso.");
  }

  function deleted(id: string) {
    setViewers((current) => current.filter((item) => item.id !== id));
    setSelected(null);
    setMessage("Visualizador excluído com sucesso.");
  }

  return (
    <section className="dashboard-section" aria-label="Visualizadores do dashboard">
      <div className="dashboard-section-heading">
        <div>
          <span className="eyebrow">Somente leitura</span>
          <h2>Visualizadores do dashboard</h2>
        </div>
        <span>{viewers.length} {viewers.length === 1 ? "acesso" : "acessos"}</span>
      </div>

      <form className="form-card user-form" onSubmit={create}>
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
          <span>Senha</span>
          <input
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            minLength={8}
            autoComplete="new-password"
            required
          />
        </label>
        <div>
          <span className="muted-state">
            Acesso a todas as lojas, apenas para consulta do Dashboard.
          </span>
        </div>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Cadastrar visualizador"}
        </button>
      </form>

      {message ? <p className="feedback-message">{message}</p> : null}

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Acesso</th>
                <th>Situação</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {viewers.map((viewer) => (
                <tr key={viewer.id}>
                  <td>{viewer.nome}</td>
                  <td>{viewer.login}</td>
                  <td>Dashboard · somente leitura</td>
                  <td>{viewer.ativo ? "Ativo" : "Inativo"}</td>
                  <td className="table-action">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => setSelected(viewer)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {viewers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    Nenhum visualizador cadastrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selected ? (
        <DashboardViewerDialog
          viewer={selected}
          onClose={() => setSelected(null)}
          onSaved={saved}
          onDeleted={deleted}
        />
      ) : null}
    </section>
  );
}

function DashboardViewerDialog({
  viewer,
  onClose,
  onSaved,
  onDeleted,
}: {
  viewer: DashboardViewer;
  onClose: () => void;
  onSaved: (viewer: DashboardViewer) => void;
  onDeleted: (id: string) => void;
}) {
  const [nome, setNome] = useState(viewer.nome);
  const [login, setLogin] = useState(viewer.login);
  const [senha, setSenha] = useState("");
  const [ativo, setAtivo] = useState(viewer.ativo);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const updated = await apiFetch<DashboardViewer>("/api/admin/viewers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: viewer.id,
          nome: nome.trim(),
          login: login.trim(),
          ativo,
          ...(senha ? { senha } : {}),
        }),
      });
      onSaved(updated);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível atualizar o visualizador.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setMessage(null);

    try {
      await apiFetch<void>(`/api/admin/viewers/${viewer.id}`, {
        method: "DELETE",
      });
      onDeleted(viewer.id);
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível excluir o visualizador.",
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
        aria-labelledby="edit-viewer-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Somente leitura</span>
            <h2 id="edit-viewer-title">Editar visualizador</h2>
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
              <span>Status</span>
              <select
                value={ativo ? "ativo" : "inativo"}
                onChange={(event) => setAtivo(event.target.value === "ativo")}
              >
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </label>
            <label>
              <span>Permissão</span>
              <input value="Dashboard · somente leitura" readOnly />
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
                <strong>Excluir visualizador</strong>
                <span>Remove o acesso ao Dashboard imediatamente.</span>
              </div>
              <button
                className="danger-button"
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
              >
                Excluir visualizador
              </button>
            </>
          ) : (
            <>
              <div>
                <strong>{`Excluir ${viewer.nome}?`}</strong>
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
                  onClick={() => void remove()}
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
