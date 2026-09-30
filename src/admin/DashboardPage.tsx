import { useEffect, useState } from "react";
import { AgendaDatePicker } from "../agenda/AgendaDatePicker";
import { apiFetch } from "../lib/api";
import { AdminAgendaPreview } from "./AdminAgendaPreview";
import { ImportAgendaPage } from "./ImportAgendaPage";
import type { AdminAgendaSummary, AdminStore, AdminStorePresence } from "./types";

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

function presenceLabel(status: AdminStorePresence["status"]) {
  switch (status) {
    case "online":
      return "Online";
    case "away":
      return "Ausente";
    case "offline":
      return "Offline";
  }
}

export function DashboardPage({
  readOnly = false,
}: {
  readOnly?: boolean;
} = {}) {
  const [today] = useState(businessDate);
  const [selectedDate, setSelectedDate] = useState(today);
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [agendas, setAgendas] = useState<AdminAgendaSummary[]>([]);
  const [presences, setPresences] = useState<AdminStorePresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewAgendaId, setPreviewAgendaId] = useState<string | null>(null);

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

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshAgendas({ silent: true });
        void refreshPresence();
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () =>
      document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [selectedDate]);

  useEffect(() => {
    void refreshPresence();

    const presenceRefresh = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshPresence();
      }
    }, 60_000);

    return () => window.clearInterval(presenceRefresh);
  }, []);

  const agendaByStore = new Map(
    agendas.map((agenda) => [agenda.storeCode, agenda]),
  );
  const presenceByStore = new Map(
    presences.map((presence) => [presence.storeId, presence]),
  );

  async function refreshPresence() {
    try {
      const data = await apiFetch<AdminStorePresence[]>("/api/admin/presence");
      setPresences(data);
    } catch {
      // Presença é complementar: uma falha não deve derrubar o dashboard.
    }
  }

  async function refreshAgendas(options: { silent?: boolean } = {}) {
    if (!options.silent) setRefreshing(true);

    try {
      const agendaData = await apiFetch<AdminAgendaSummary[]>(
        `/api/admin/agendas?date=${selectedDate}`,
      );
      setAgendas(agendaData);
      if (!options.silent) setError(null);
    } catch {
      if (!options.silent) {
        setError("Não foi possível atualizar o dashboard.");
      }
    } finally {
      if (!options.silent) setRefreshing(false);
    }
  }

  return (
    <section className="admin-page">
      <header className="page-heading page-heading-actions">
        <div>
          <span className="eyebrow">{readOnly ? "Acompanhamento" : "Administração"}</span>
          <h1>Dashboard</h1>
          <p>
            {readOnly
              ? "Acompanhe as agendas por loja e atualize quando necessário."
              : "Acompanhe as agendas por loja e importe novas agendas."}
          </p>
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
            className="ghost-button"
            type="button"
            disabled={refreshing}
            onClick={() => {
              void refreshAgendas();
              void refreshPresence();
            }}
          >
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>

          {!readOnly ? (
            <button
              className="primary-button dashboard-import-action"
              type="button"
              onClick={() => setImportOpen(true)}
            >
              Importar agenda
            </button>
          ) : null}
        </div>
      </header>

      {loading ? <p className="muted-state">Carregando agendas...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!readOnly && importOpen ? (
        <ImportAgendaPage
          modal
          onClose={() => setImportOpen(false)}
          onImported={() => void refreshAgendas()}
        />
      ) : null}

      {previewAgendaId ? (
        <AdminAgendaPreview
          agendaId={previewAgendaId}
          canReopen={!readOnly}
          onClose={() => setPreviewAgendaId(null)}
          onAgendaChanged={() => void refreshAgendas()}
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
                const presence = presenceByStore.get(store.id);
                const presenceStatus = presence?.status ?? "offline";
                const presenceText = presenceLabel(presenceStatus);

                return (
                  <article
                    className={`store-card dashboard-store-card ${
                      agenda?.dayStatus === "concluido"
                        ? "is-completed"
                        : agenda
                          ? "is-open"
                          : "is-empty"
                    }`}
                    key={store.id}
                    data-testid={`dashboard-store-${store.codigo}`}
                  >
                    <div className="store-card-header">
                      <div className="store-card-identity">
                        <span
                          className={`presence-dot ${presenceStatus}`}
                          role="img"
                          aria-label={`Conferente ${presenceText.toLowerCase()}`}
                          title={presenceText}
                        />
                        <div className="store-card-title">
                          <strong>{store.codigo}</strong>
                          <span>{store.nome}</span>
                        </div>
                      </div>
                      <div
                        className="store-card-header-actions"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-end",
                          gap: "0.4rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span className={agenda ? "status-pill neutral" : "status-pill warning"}>
                          {agenda ? "Agenda importada" : "Sem agenda"}
                        </span>
                        {agenda ? (
                          <span
                            className={`status-pill ${
                              agenda.dayStatus === "concluido"
                                ? "success"
                                : "warning"
                            }`}
                          >
                            {agenda.dayStatus === "concluido"
                              ? "✓ Concluído"
                              : "Em andamento"}
                          </span>
                        ) : null}
                        {agenda ? (
                          <button
                            className="status-pill neutral dashboard-store-details"
                            style={{
                              border: 0,
                              minHeight: 0,
                              padding: "0.32rem 0.55rem",
                              fontSize: "0.72rem",
                            }}
                            type="button"
                            onClick={() => setPreviewAgendaId(agenda.id)}
                          >
                            Ver detalhes
                          </button>
                        ) : null}
                      </div>
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
