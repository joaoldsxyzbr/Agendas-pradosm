import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import type { AdminAgendaSummary, AdminStore } from "./types";

type DashboardTotals = {
  total: number;
  aguardando: number;
  recebido: number;
  naoChegou: number;
  recusado: number;
  semAgenda: number;
};

const emptyTotals: DashboardTotals = {
  total: 0,
  aguardando: 0,
  recebido: 0,
  naoChegou: 0,
  recusado: 0,
  semAgenda: 0,
};

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

  const agendaByStore = new Map(
    agendas.map((agenda) => [agenda.storeCode, agenda]),
  );

  const totals = agendas.reduce<DashboardTotals>(
    (current, agenda) => ({
      total: current.total + agenda.total,
      aguardando: current.aguardando + agenda.aguardando,
      recebido: current.recebido + agenda.recebido,
      naoChegou: current.naoChegou + agenda.naoChegou,
      recusado: current.recusado + agenda.recusado,
      semAgenda: current.semAgenda + agenda.semAgenda,
    }),
    emptyTotals,
  );

  const storesWithoutAgenda = stores.filter(
    (store) => !agendaByStore.has(store.codigo),
  ).length;

  const attention = stores
    .map((store) => ({
      store,
      agenda: agendaByStore.get(store.codigo),
    }))
    .filter((item) => !item.agenda || item.agenda.aguardando > 0)
    .sort((a, b) => {
      if (!a.agenda && b.agenda) return -1;
      if (a.agenda && !b.agenda) return 1;
      return (b.agenda?.aguardando ?? 0) - (a.agenda?.aguardando ?? 0);
    });

  return (
    <section className="admin-page">
      <header className="page-heading page-heading-actions">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Dashboard</h1>
          <p>Veja rapidamente como está o recebimento de hoje em todas as lojas.</p>
        </div>
        <Link className="primary-button dashboard-import-action" to="/admin/import">
          Importar agenda
        </Link>
      </header>

      {loading ? <p className="muted-state">Carregando agendas...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <section className="dashboard-kpis" aria-label="Resumo operacional">
            <article className="dashboard-kpi" data-testid="dashboard-kpi-total">
              <span>Total recebimentos</span>
              <strong>{totals.total}</strong>
            </article>
            <article className="dashboard-kpi" data-testid="dashboard-kpi-aguardando">
              <span>Aguardando</span>
              <strong>{totals.aguardando}</strong>
            </article>
            <article className="dashboard-kpi" data-testid="dashboard-kpi-recebidos">
              <span>Recebidos</span>
              <strong>{totals.recebido}</strong>
            </article>
            <article className="dashboard-kpi" data-testid="dashboard-kpi-nao-chegaram">
              <span>Não chegaram</span>
              <strong>{totals.naoChegou}</strong>
            </article>
            <article className="dashboard-kpi" data-testid="dashboard-kpi-recusados">
              <span>Recusados</span>
              <strong>{totals.recusado}</strong>
            </article>
            <article className="dashboard-kpi" data-testid="dashboard-kpi-sem-agenda">
              <span>Sem agenda</span>
              <strong>{totals.semAgenda}</strong>
            </article>
            <article
              className="dashboard-kpi"
              data-testid="dashboard-kpi-lojas-sem-agenda"
            >
              <span>Lojas sem agenda</span>
              <strong>{storesWithoutAgenda}</strong>
            </article>
          </section>

          <section className="dashboard-attention" aria-label="Atenção agora">
            <div className="dashboard-section-heading">
              <div>
                <span className="eyebrow">Prioridade</span>
                <h2>Atenção agora</h2>
              </div>
              <span>{attention.length} {attention.length === 1 ? "loja" : "lojas"}</span>
            </div>

            {attention.length > 0 ? (
              <div className="dashboard-attention-list">
                {attention.map(({ store, agenda }) => (
                  <article className="dashboard-attention-item" key={store.id}>
                    <div>
                      <strong>{store.codigo}</strong>
                      <span>{store.nome}</span>
                    </div>
                    {agenda ? (
                      <span className="status-pill warning">
                        {agenda.aguardando} aguardando
                      </span>
                    ) : (
                      <span className="status-pill warning">
                        Agenda não importada
                      </span>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="dashboard-all-clear">Nenhuma pendência agora.</p>
            )}
          </section>

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
