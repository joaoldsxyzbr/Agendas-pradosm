import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { ImportAgendaPage } from "./ImportAgendaPage";
import type { AdminAgendaSummary, AdminStore } from "./types";

export function DashboardPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [agendas, setAgendas] = useState<AdminAgendaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let active = true;

    void Promise.all([
      apiFetch<AdminStore[]>("/api/admin/stores"),
      apiFetch<AdminAgendaSummary[]>("/api/admin/agendas/today"),
    ])
      .then(([storeData, agendaData]) => {
        if (!active) return;
        setStores(storeData.filter((store) => store.ativo));
        setAgendas(agendaData);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar o dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const agendaByStore = new Map(
    agendas.map((agenda) => [agenda.storeCode, agenda]),
  );

  async function refreshAgendas() {
    try {
      const agendaData = await apiFetch<AdminAgendaSummary[]>(
        "/api/admin/agendas/today",
      );
      setAgendas(agendaData);
    } catch {
      setError("A agenda foi importada, mas o dashboard não pôde ser atualizado.");
    }
  }

  return (
    <section className="admin-page">
      <header className="page-heading page-heading-actions">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Dashboard</h1>
          <p>Acompanhe as agendas por loja e importe novas agendas.</p>
        </div>
        <button
          className="primary-button dashboard-import-action"
          type="button"
          onClick={() => setImportOpen(true)}
        >
          Importar agenda
        </button>
      </header>

      {loading ? <p className="muted-state">Carregando agendas...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {importOpen ? (
        <ImportAgendaPage
          modal
          onClose={() => setImportOpen(false)}
          onImported={() => void refreshAgendas()}
        />
      ) : null}

      {!loading && !error ? (
        <>
          <section className="dashboard-section" aria-label="Situação por loja">
            <div className="dashboard-section-heading">
              <div>
                <span className="eyebrow">Operação</span>
                <h2>Por loja</h2>
              </div>
              <span>{stores.length} {stores.length === 1 ? "loja ativa" : "lojas ativas"}</span>
            </div>

            <div className="dashboard-grid">
              {stores.map((store) => {
                const agenda = agendaByStore.get(store.codigo);

                return (
                  <article
                    className="store-card dashboard-store-card"
                    key={store.id}
                    data-testid={`dashboard-store-${store.codigo}`}
                  >
                    <div className="store-card-header">
                      <div>
                        <strong>{store.codigo}</strong>
                        <span>{store.nome}</span>
                      </div>
                      <span className={agenda ? "status-pill neutral" : "status-pill warning"}>
                        {agenda ? "Agenda importada" : "Sem agenda hoje"}
                      </span>
                    </div>

                    {agenda ? (
                      <>
                        <div className="store-progress">
                          <span>Recebidos</span>
                          <strong>{agenda.recebido} / {agenda.total}</strong>
                        </div>
                        <div className="store-card-metrics">
                          <span>{agenda.aguardando} aguardando</span>
                          <span>{agenda.naoChegou} não chegaram</span>
                          <span>{agenda.recusado} recusados</span>
                          {agenda.semAgenda > 0 ? (
                            <span>{agenda.semAgenda} sem agenda</span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <p className="empty-copy">
                        Nenhuma agenda foi importada para esta loja hoje.
                      </p>
                    )}
                  </article>
                );
              })}

              {stores.length === 0 ? (
                <div className="empty-panel">Nenhuma loja ativa cadastrada.</div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </section>
  );
}
