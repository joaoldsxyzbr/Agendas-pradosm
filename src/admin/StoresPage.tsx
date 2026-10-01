import { useEffect, useState, type FormEvent } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { StoreEditDialog } from "./StoreEditDialog";
import type { AdminStore } from "./types";

type StoreStatusFilter = "todas" | "ativas" | "inativas";

export function StoresPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<AdminStore | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StoreStatusFilter>("todas");
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

  function resetCreateForm() {
    setCodigo("");
    setNome("");
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
      await apiFetch<AdminStore>("/api/admin/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: codigo.trim().toUpperCase(),
          nome: nome.trim(),
        }),
      });
      resetCreateForm();
      setCreateOpen(false);
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

  function storeSaved(updated: AdminStore) {
    setStores((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setSelectedStore(null);
    setMessage("Loja atualizada com sucesso.");
  }

  function storeDeleted(storeId: string) {
    setStores((current) => current.filter((item) => item.id !== storeId));
    setSelectedStore(null);
    setMessage("Loja excluída com sucesso.");
  }

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredStores = stores.filter((store) => {
    const matchesSearch =
      !normalizedSearch ||
      [store.codigo, store.nome]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedSearch);
    const matchesStatus =
      statusFilter === "todas" ||
      (statusFilter === "ativas" ? store.ativo : !store.ativo);

    return matchesSearch && matchesStatus;
  });
  const activeStores = stores.filter((store) => store.ativo).length;

  return (
    <section className="admin-page registry-page">
      <header className="page-heading registry-page-heading">
        <div>
          <span className="eyebrow">Cadastros</span>
          <h1>Lojas</h1>
          <p>Gerencie as unidades habilitadas para recebimento.</p>
        </div>
        <div className="registry-heading-actions">
          <span className="registry-heading-meta">
            {stores.length} {stores.length === 1 ? "loja" : "lojas"} · {activeStores} ativas
          </span>
          <button
            className="primary-button registry-new-button"
            type="button"
            onClick={() => {
              setMessage(null);
              setCreateOpen(true);
            }}
          >
            + Nova loja
          </button>
        </div>
      </header>

      {message ? <p className="feedback-message">{message}</p> : null}

      <div className="table-card registry-card">
        <div className="registry-toolbar registry-toolbar-stores">
          <label className="registry-search">
            <span className="sr-only">Buscar loja</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por código ou nome..."
              aria-label="Buscar loja"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por situação</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StoreStatusFilter)
              }
              aria-label="Filtrar por situação"
            >
              <option value="todas">Todas as situações</option>
              <option value="ativas">Ativas</option>
              <option value="inativas">Inativas</option>
            </select>
          </label>
        </div>

        <div className="table-scroll">
          <table className="registry-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nome</th>
                <th>Situação</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStores.map((store) => (
                <tr key={store.id}>
                  <td className="registry-code-cell">{store.codigo}</td>
                  <td className="registry-primary-cell">{store.nome}</td>
                  <td>
                    <span
                      className={`registry-status ${store.ativo ? "is-active" : "is-inactive"}`}
                    >
                      {store.ativo ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="table-action">
                    <button
                      className="ghost-button registry-edit-button"
                      type="button"
                      onClick={() => setSelectedStore(store)}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    Nenhuma loja encontrada.
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
            aria-labelledby="create-store-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Nova unidade</span>
                <h2 id="create-store-title">Cadastrar loja</h2>
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
                  <span>Código</span>
                  <input
                    value={codigo}
                    onChange={(event) => setCodigo(event.target.value)}
                    placeholder="F03 ou CD DOCA 01"
                    maxLength={20}
                    autoFocus
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
                  {saving ? "Salvando..." : "Cadastrar loja"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {selectedStore ? (
        <StoreEditDialog
          store={selectedStore}
          onClose={() => setSelectedStore(null)}
          onSaved={storeSaved}
          onDeleted={storeDeleted}
        />
      ) : null}
    </section>
  );
}
