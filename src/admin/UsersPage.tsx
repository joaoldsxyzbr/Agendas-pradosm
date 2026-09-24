import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AdminStore, AdminUser } from "./types";

export function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
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
    void load().catch(() => setMessage("Não foi possível carregar os usuários."));
  }, []);

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
          lojaId,
        }),
      });
      setNome("");
      setLogin("");
      setSenha("");
      setLojaId("");
      setMessage("Usuário cadastrado com sucesso.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : "Não foi possível cadastrar o usuário.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle(user: AdminUser) {
    setMessage(null);
    try {
      await apiFetch<AdminUser>("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, ativo: !user.ativo }),
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : "Não foi possível alterar o usuário.",
      );
    }
  }

  const storeName = new Map(stores.map((store) => [store.id, `${store.codigo} - ${store.nome}`]));

  return (
    <section className="admin-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h1>Usuários</h1>
          <p>Crie acessos de conferentes vinculados a uma loja.</p>
        </div>
      </header>

      <form className="form-card user-form" onSubmit={submit}>
        <label>
          <span>Nome</span>
          <input value={nome} onChange={(event) => setNome(event.target.value)} required />
        </label>
        <label>
          <span>Login</span>
          <input value={login} onChange={(event) => setLogin(event.target.value)} required />
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
        <label>
          <span>Loja</span>
          <select value={lojaId} onChange={(event) => setLojaId(event.target.value)} required>
            <option value="">Selecione</option>
            {stores.filter((store) => store.ativo).map((store) => (
              <option key={store.id} value={store.id}>
                {store.codigo} - {store.nome}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Cadastrar usuário"}
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
                <th>Loja</th>
                <th>Situação</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.nome}</td>
                  <td>{user.login}</td>
                  <td>{storeName.get(user.lojaId) ?? "Loja não localizada"}</td>
                  <td>{user.ativo ? "Ativo" : "Inativo"}</td>
                  <td className="table-action">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => void toggle(user)}
                    >
                      {user.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr><td colSpan={5} className="empty-cell">Nenhum usuário cadastrado.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
