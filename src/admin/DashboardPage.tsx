import { useEffect, useState } from "react";
import { AgendaDatePicker } from "../agenda/AgendaDatePicker";
import { apiFetch } from "../lib/api";
import { ImportAgendaPage } from "./ImportAgendaPage";
import type { AdminAgendaSummary, AdminStore } from "./types";

function businessDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

export function DashboardPage() {
  const [today] = useState(businessDate);
  const [selectedDate, setSelectedDate] = useState(today);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [agendas, setAgendas] = useState<AdminAgendaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    void Promise.all([
      apiFetch<AdminStore[]>("/api/admin/stores"),
      apiFetch<AdminAgendaSummary[]>(
        `/api/admin/agendas?date=${selectedDate}`,
      ),
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
  }, [selectedDate]);

  const agendaByStore = new Map(
    agendas.map((agenda) => [agenda.storeCode, agenda]),
  );

  async function refreshAgendas() {
    try {
      const agendaData = await apiFetch<AdminAgendaSummary[]>(
        `/api/admin/agendas?date=${selectedDate}`,
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
        <div className="dashboard-header-actions">
          <div className="dashboard-date-controls">
            <button
              className="ghost-button dashboard-date-step"
              type="button"
              aria-label="Dia anterior"
              onClick={() =>
                setSelectedDate((current) => addDays(current, -1))
              }
            >
              ‹
            </button>

            <AgendaDatePicker
              value={selectedDate}
              today={today}
              onChange={setSelectedDate}
            />

            <button
              className="ghost-button dashboard-date-step"
              type="button"
              aria-label="Dia seguinte"
              onClick={() =>
                setSelectedDate((current) => addDays(current, 1))
              }
            >
              ›
            </button>
          </div>

          <button
            className="primary-button dashboard-import-action"
            type="button"
            onClick={() => setImportOpen(true)}
          >
            Importar agenda
          </button>
        </div>
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
                        {agenda ? "Agenda importada" : "Sem agenda"}
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
                        Nenhuma agenda foi importada para esta loja em{" "}
                        {formatDate(selectedDate)}.
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
