import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import type { AdminAgendaSummary, AdminStore } from "./types";

export function DashboardPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [agendas, setAgendas] = useState<AdminAgendaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const agendaByStore = new Map(agendas.map((agenda) => [agenda.storeCode, agenda]));

  return (
    <section className="admin-page">
      <header className="page-heading page-heading-actions">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Dashboard</h1>
          <p>Acompanhe a situação das agendas de hoje por loja.</p>
        </div>
        <Link className="primary-button dashboard-import-action" to="/admin/import">
          Importar agenda
        </Link>
      </header>

      {loading ? <p className="muted-state">Carregando agendas...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading && !error ? (
        <div className="dashboard-grid">
          {stores.map((store) => {
            const agenda = agendaByStore.get(store.codigo);

            return (
              <article className="store-card" key={store.id}>
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
                  <dl className="metric-grid">
                    <div><dt>Total</dt><dd>{agenda.total}</dd></div>
                    <div><dt>Aguardando</dt><dd>{agenda.aguardando}</dd></div>
                    <div><dt>Recebidos</dt><dd>{agenda.recebido}</dd></div>
                    <div><dt>Não chegaram</dt><dd>{agenda.naoChegou}</dd></div>
                    <div><dt>Recusados</dt><dd>{agenda.recusado}</dd></div>
                  </dl>
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
      ) : null}
    </section>
  );
}
