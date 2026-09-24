import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AdminStore } from "./types";

export function StoresPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setStores(await apiFetch<AdminStore[]>("/api/admin/stores"));
  }

  useEffect(() => {
    void load().catch(() => setMessage("Não foi possível carregar as lojas."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await apiFetch<AdminStore>("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: codigo.trim().toUpperCase(),
          nome: nome.trim(),
        }),
      });
      setCodigo("");
      setNome("");
      setMessage("Loja cadastrada com sucesso.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : "Não foi possível cadastrar a loja.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggle(store: AdminStore) {
    setMessage(null);
    try {
      await apiFetch<AdminStore>("/api/admin/stores", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: store.id, ativo: !store.ativo }),
      });
      await load();
    } catch (error) {
      setMessage(
        error instanceof ApiError ? error.message : "Não foi possível alterar a loja.",
      );
    }
  }

  return (
    <section className="admin-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h1>Lojas</h1>
          <p>Cadastre e controle quais lojas podem receber agendas.</p>
        </div>
      </header>

      <form className="form-card compact-form" onSubmit={submit}>
        <label>
          <span>Código</span>
          <input
            value={codigo}
            onChange={(event) => setCodigo(event.target.value)}
            placeholder="F03"
            pattern="[Ff][0-9]{1,4}"
            required
          />
        </label>
        <label className="wide-field">
          <span>Nome</span>
          <input
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            maxLength={120}
            required
          />
        </label>
        <button className="primary-button" type="submit" disabled={saving}>
          {saving ? "Salvando..." : "Cadastrar loja"}
        </button>
      </form>

      {message ? <p className="feedback-message">{message}</p> : null}

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Situação</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id}>
                  <td>{store.codigo}</td>
                  <td>{store.nome}</td>
                  <td>{store.ativo ? "Ativa" : "Inativa"}</td>
                  <td className="table-action">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => void toggle(store)}
                    >
                      {store.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
              {stores.length === 0 ? (
                <tr><td colSpan={4} className="empty-cell">Nenhuma loja cadastrada.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
