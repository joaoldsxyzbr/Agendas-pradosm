import { useEffect, useState, type FormEvent } from "react";
import type { UserRole } from "../../shared/auth";
import { ApiError, apiFetch } from "../lib/api";
import { UserEditDialog } from "./UserEditDialog";
import type { AdminStore, AdminUser } from "./types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  conferente: "Conferente",
  visualizador: "Visualizador",
};

type UserStatusFilter = "todos" | "ativos" | "inativos";
type UserRoleFilter = "todos" | UserRole;

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("todos");
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<UserRole>("conferente");
  const [lojaId, setLojaId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [userData, storeData] = await Promise.all([
      apiFetch<AdminUser[]>("/api/admin/users"),
      apiFetch<AdminStore[]>("/api/admin/stores"),
    ]);
    setUsers(userData);
    setStores(storeData);
  }

  useEffect(() => {
    void load().catch(() =>
      setMessage("Não foi possível carregar os usuários."),
    );
  }, []);

  function resetCreateForm() {
    setNome("");
    setLogin("");
    setSenha("");
    setPapel("conferente");
    setLojaId("");
  }

  function closeCreate() {
    if (saving) return;
    setCreateOpen(false);
    resetCreateForm();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await apiFetch<AdminUser>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim(),
          login: login.trim(),
          senha,
          papel,
          ...(papel === "conferente" ? { lojaId } : {}),
        }),
      });
      resetCreateForm();
      setCreateOpen(false);
      setMessage("Usuário cadastrado com sucesso.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiError
          ? error.message
          : "Não foi possível cadastrar o usuário.",
      );
    } finally {
      setSaving(false);
    }
  }

  function userSaved(updated: AdminUser) {
    setUsers((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setSelectedUser(null);
    setMessage("Usuário atualizado com sucesso.");
  }

  function userDeleted(userId: string) {
    setUsers((current) => current.filter((item) => item.id !== userId));
    setSelectedUser(null);
    setMessage("Usuário excluído com sucesso.");
  }

  const storeName = new Map(
    stores.map((store) => [store.id, `${store.codigo} - ${store.nome}`]),
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredUsers = users.filter((user) => {
    const store = user.lojaId ? (storeName.get(user.lojaId) ?? "") : "";
    const matchesSearch =
      !normalizedSearch ||
      [user.nome, user.login, store, ROLE_LABELS[user.papel]]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch);
    const matchesRole = roleFilter === "todos" || user.papel === roleFilter;
    const matchesStatus =
      statusFilter === "todos" ||
      (statusFilter === "ativos" ? user.ativo : !user.ativo);

    return matchesSearch && matchesRole && matchesStatus;
  });
  const activeUsers = users.filter((user) => user.ativo).length;

  return (
    <section className="admin-page registry-page">
      <header className="page-heading registry-page-heading">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h1>Usuários</h1>
          <p>Gerencie os acessos ao sistema.</p>
        </div>
        <div className="registry-heading-actions">
          <span className="registry-heading-meta">
            {users.length} {users.length === 1 ? "usuário" : "usuários"} · {activeUsers} ativos
          </span>
          <button
            className="primary-button registry-new-button"
            type="button"
            onClick={() => {
              setMessage(null);
              setCreateOpen(true);
            }}
          >
            + Novo usuário
          </button>
        </div>
      </header>

      {message ? <p className="feedback-message">{message}</p> : null}

      <div className="table-card registry-card">
        <div className="registry-toolbar registry-toolbar-users">
          <label className="registry-search">
            <span className="sr-only">Buscar usuário</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, login ou loja..."
              aria-label="Buscar usuário"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por papel</span>
            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as UserRoleFilter)
              }
              aria-label="Filtrar por papel"
            >
              <option value="todos">Todos os papéis</option>
              <option value="admin">Administrador</option>
              <option value="conferente">Conferente</option>
              <option value="visualizador">Visualizador</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por situação</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as UserStatusFilter)
              }
              aria-label="Filtrar por situação"
            >
              <option value="todos">Todas as situações</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </label>
        </div>

        <div className="table-scroll">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Login</th>
                <th>Loja</th>
                <th>Papel</th>
                <th>Situação</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td className="registry-primary-cell">{user.nome}</td>
                  <td>{user.login}</td>
                  <td>
                    {user.lojaId
                      ? (storeName.get(user.lojaId) ?? "Loja não localizada")
                      : "—"}
                  </td>
                  <td>{ROLE_LABELS[user.papel]}</td>
                  <td>
                    <span
                      className={`registry-status ${user.ativo ? "is-active" : "is-inactive"}`}
                    >
                      {user.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="table-action">
                    <button
                      className="ghost-button registry-edit-button"
                      type="button"
                      onClick={() => setSelectedUser(user)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen ? (
        <div className="modal-backdrop">
          <section
            className="modal-card registry-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Novo acesso</span>
                <h2 id="create-user-title">Cadastrar usuário</h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={closeCreate}
                disabled={saving}
              >
                Fechar
              </button>
            </div>

            <form className="modal-form" onSubmit={submit}>
              <div className="modal-form-grid">
                <label>
                  <span>Nome</span>
                  <input
                    value={nome}
                    onChange={(event) => setNome(event.target.value)}
                    autoFocus
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
                    minLength={12}
                    autoComplete="new-password"
                    required
                  />
                </label>
                <label>
                  <span>Papel</span>
                  <select
                    value={papel}
                    onChange={(event) =>
                      setPapel(event.target.value as UserRole)
                    }
                  >
                    <option value="admin">Administrador</option>
                    <option value="conferente">Conferente</option>
                    <option value="visualizador">Visualizador</option>
                  </select>
                </label>
                {papel === "conferente" ? (
                  <label className="modal-wide-field">
                    <span>Loja</span>
                    <select
                      value={lojaId}
                      onChange={(event) => setLojaId(event.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      {stores
                        .filter((store) => store.ativo)
                        .map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.codigo} - {store.nome}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="modal-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={closeCreate}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Cadastrar usuário"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {selectedUser ? (
        <UserEditDialog
          user={selectedUser}
          stores={stores}
          onClose={() => setSelectedUser(null)}
          onSaved={userSaved}
          onDeleted={userDeleted}
        />
      ) : null}
    </section>
  );
}
