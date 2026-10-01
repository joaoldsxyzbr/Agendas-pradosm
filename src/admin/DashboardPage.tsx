import { useEffect, useRef, useState } from "react";
import { businessDate } from "../../shared/time";
import { AgendaDatePicker } from "../agenda/AgendaDatePicker";
import { apiFetch } from "../lib/api";
import {
  useRealtimeEvent,
  useRealtimeState,
} from "../realtime/useRealtimeConnection";
import { AdminAgendaPreview } from "./AdminAgendaPreview";
import { ImportAgendaPage } from "./ImportAgendaPage";
import type { AdminAgendaSummary, AdminStore, AdminStorePresence } from "./types";

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
  const [realtimePresences, setRealtimePresences] = useState<AdminStorePresence[]>([]);
  const realtime = useRealtimeState();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewAgendaId, setPreviewAgendaId] = useState<string | null>(null);
  const realtimeAgendaRefreshTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (realtimeAgendaRefreshTimer.current !== null) {
        window.clearTimeout(realtimeAgendaRefreshTimer.current);
      }
    };
  }, []);

  useRealtimeEvent((event) => {
    if (event.type === "presence.snapshot") {
      setRealtimePresences(event.stores);
      return;
    }

    if (event.type === "presence.changed") {
      setRealtimePresences((current) => {
        const next = new Map(
          current.map((presence) => [presence.storeId, presence]),
        );
        next.set(event.storeId, {
          storeId: event.storeId,
          status: event.status,
        });
        return [...next.values()];
      });
      return;
    }

    if (event.type === "agenda.changed" && event.date === selectedDate) {
      if (realtimeAgendaRefreshTimer.current !== null) return;

      realtimeAgendaRefreshTimer.current = window.setTimeout(() => {
        realtimeAgendaRefreshTimer.current = null;
        void refreshAgendas({ silent: true });
      }, 75);
    }
  }, [selectedDate]);

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

        if (
          realtime.mode !== "on" ||
          realtime.status !== "connected"
        ) {
          void refreshPresence();
        }
      }
    };

    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () =>
      document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [selectedDate, realtime.mode, realtime.status]);

  useEffect(() => {
    void refreshPresence();
  }, [realtime.mode, realtime.status]);

  const agendaByStore = new Map(
    agendas.map((agenda) => [agenda.storeCode, agenda]),
  );
  const activePresences =
    realtime.mode === "on" && realtime.status === "connected"
      ? realtimePresences
      : presences;
  const presenceByStore = new Map(
    activePresences.map((presence) => [presence.storeId, presence]),
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

  const storesWithAgenda = stores.filter((store) =>
    agendaByStore.has(store.codigo),
  ).length;
  const completedStores = stores.filter(
    (store) => agendaByStore.get(store.codigo)?.dayStatus === "concluido",
  ).length;
  const openStores = stores.filter((store) => {
    const agenda = agendaByStore.get(store.codigo);
    return agenda && agenda.dayStatus !== "concluido";
  }).length;
  const storesWithoutAgenda = Math.max(0, stores.length - storesWithAgenda);

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
          <section
            className="dashboard-section dashboard-operations"
            aria-label="Situação por loja"
          >
            <div className="dashboard-section-heading dashboard-operations-heading">
              <div>
                <span className="eyebrow">Operação</span>
                <h2>Recebimento por loja</h2>
              </div>
              <span>{formatDate(selectedDate)}</span>
            </div>

            <div
              className="dashboard-operation-summary"
              aria-label="Situação do dia"
            >
              <span>
                <strong>{stores.length}</strong>
                lojas
              </span>
              <span>
                <strong>{storesWithAgenda}</strong>
                com agenda
              </span>
              <span>
                <strong>{openStores}</strong>
                em andamento
              </span>
              <span>
                <strong>{completedStores}</strong>
                concluídas
              </span>
              <span>
                <strong>{storesWithoutAgenda}</strong>
                sem agenda
              </span>
            </div>

            {stores.length > 0 ? (
              <div className="dashboard-operation-table table-card">
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Loja</th>
                        <th>Presença</th>
                        <th>Agenda</th>
                        <th>Andamento</th>
                        <th>Pendências</th>
                        <th>Situação</th>
                        <th>
                          <span className="sr-only">Ações</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((store) => {
                        const agenda = agendaByStore.get(store.codigo);
                        const presence = presenceByStore.get(store.id);
                        const presenceStatus = presence?.status ?? "offline";
                        const presenceText = presenceLabel(presenceStatus);

                        return (
                          <tr
                            className={`dashboard-operation-row ${
                              agenda?.dayStatus === "concluido"
                                ? "is-completed"
                                : agenda
                                  ? "is-open"
                                  : "is-empty"
                            }`}
                            key={store.id}
                            data-testid={`dashboard-store-${store.codigo}`}
                          >
                            <td className="dashboard-store-cell">
                              <strong>{store.codigo}</strong>
                              <span>{store.nome}</span>
                            </td>
                            <td>
                              <span className="dashboard-presence">
                                <span
                                  className={`presence-dot ${presenceStatus}`}
                                  role="img"
                                  aria-label={`Conferente ${presenceText.toLowerCase()}`}
                                  title={presenceText}
                                />
                                {presenceText}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`dashboard-agenda-state ${
                                  agenda ? "has-agenda" : "no-agenda"
                                }`}
                              >
                                {agenda ? "Importada" : "Sem agenda"}
                              </span>
                            </td>
                            <td className="dashboard-progress-cell">
                              {agenda ? (
                                <>
                                  <strong>
                                    {agenda.recebido} / {agenda.total}
                                  </strong>
                                  <span>recebidos</span>
                                </>
                              ) : (
                                <span className="dashboard-empty-value">—</span>
                              )}
                            </td>
                            <td className="dashboard-pending-cell">
                              {agenda ? (
                                <div>
                                  <span>{agenda.aguardando} aguardando</span>
                                  <span>{agenda.naoChegou} não recebidos</span>
                                  {agenda.recusado > 0 ? (
                                    <span>{agenda.recusado} recusados</span>
                                  ) : null}
                                  {agenda.semAgenda > 0 ? (
                                    <span>{agenda.semAgenda} sem agenda</span>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="dashboard-no-agenda-copy">
                                  Não importada em {formatDate(selectedDate)}
                                </span>
                              )}
                            </td>
                            <td>
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
                              ) : (
                                <span className="status-pill muted">
                                  Pendente
                                </span>
                              )}
                            </td>
                            <td className="table-action">
                              {agenda ? (
                                <button
                                  className="ghost-button dashboard-store-details"
                                  type="button"
                                  onClick={() => setPreviewAgendaId(agenda.id)}
                                >
                                  Ver detalhes
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="empty-panel">Nenhuma loja ativa cadastrada.</div>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
