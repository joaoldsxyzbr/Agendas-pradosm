import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api";
import type {
  AdminAgendaDetail,
  AdminAgendaSummary,
  AdminAppointment,
  AdminStore,
  AgendaDayHistoryItem,
  AppointmentHistoryItem,
} from "./types";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

export function AdminAgendaHistoryPage() {
  const [stores, setStores] = useState<AdminStore[]>([]);
  const [storeCode, setStoreCode] = useState("");
  const [date, setDate] = useState("");
  const [agendas, setAgendas] = useState<AdminAgendaSummary[]>([]);
  const [detail, setDetail] = useState<AdminAgendaDetail | null>(null);
  const [history, setHistory] = useState<AppointmentHistoryItem[]>([]);
  const [historyAppointmentId, setHistoryAppointmentId] = useState<string | null>(null);
  const [dayHistory, setDayHistory] = useState<AgendaDayHistoryItem[]>([]);
  const [savingAppointmentId, setSavingAppointmentId] = useState<string | null>(null);
  const [reopening, setReopening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<AdminStore[]>("/api/admin/stores")
      .then(setStores)
      .catch(() => setMessage("Não foi possível carregar as lojas."));
  }, []);

  async function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    setDetail(null);
    setHistory([]);
    setHistoryAppointmentId(null);

    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (storeCode) params.set("storeCode", storeCode);
    const suffix = params.toString() ? `?${params.toString()}` : "";

    try {
      setAgendas(
        await apiFetch<AdminAgendaSummary[]>(`/api/admin/agendas${suffix}`),
      );
    } catch {
      setMessage("Não foi possível consultar as agendas.");
    } finally {
      setLoading(false);
    }
  }

  async function openAgenda(id: string) {
    setMessage(null);
    setHistory([]);
    setHistoryAppointmentId(null);
    setDayHistory([]);

    try {
      const [agendaDetail, events] = await Promise.all([
        apiFetch<AdminAgendaDetail>(`/api/admin/agendas/${id}`),
        apiFetch<AgendaDayHistoryItem[]>(`/api/admin/agendas/${id}/history`),
      ]);
      setDetail(agendaDetail);
      setDayHistory(events);
    } catch {
      setMessage("Não foi possível abrir a agenda.");
    }
  }

  function updateAppointment(updated: AdminAppointment) {
    setDetail((current) =>
      current
        ? {
            ...current,
            appointments: current.appointments.map((appointment) =>
              appointment.id === updated.id ? updated : appointment,
            ),
          }
        : current,
    );
  }

  async function changeAppointmentStatus(
    appointmentId: string,
    status: AdminAppointment["status"],
  ) {
    setSavingAppointmentId(appointmentId);
    setMessage(null);
    try {
      const updated = await apiFetch<AdminAppointment>(
        `/api/admin/appointments/${appointmentId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      updateAppointment(updated);
      if (detail?.agenda.dayStatus === "concluido") {
        setDayHistory(
          await apiFetch<AgendaDayHistoryItem[]>(
            `/api/admin/agendas/${detail.agenda.id}/history`,
          ),
        );
      }
    } catch {
      setMessage("Não foi possível alterar o status.");
    } finally {
      setSavingAppointmentId(null);
    }
  }

  async function changeAppointmentExchanges(
    appointmentId: string,
    hasExchanges: boolean,
  ) {
    setSavingAppointmentId(appointmentId);
    setMessage(null);
    try {
      const updated = await apiFetch<AdminAppointment>(
        `/api/admin/appointments/${appointmentId}/exchanges`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hasExchanges }),
        },
      );
      updateAppointment(updated);
      if (detail?.agenda.dayStatus === "concluido") {
        setDayHistory(
          await apiFetch<AgendaDayHistoryItem[]>(
            `/api/admin/agendas/${detail.agenda.id}/history`,
          ),
        );
      }
    } catch {
      setMessage("Não foi possível alterar a marcação de trocas.");
    } finally {
      setSavingAppointmentId(null);
    }
  }

  async function reopenForStore() {
    if (!detail || reopening) return;
    setReopening(true);
    setMessage(null);
    try {
      const agenda = await apiFetch<AdminAgendaDetail["agenda"]>(
        `/api/admin/agendas/${detail.agenda.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "aberto" }),
        },
      );
      setDetail((current) => (current ? { ...current, agenda } : current));
      setAgendas((current) =>
        current.map((item) =>
          item.id === agenda.id
            ? {
                ...item,
                dayStatus: agenda.dayStatus,
                completedAt: agenda.completedAt,
                completedBy: agenda.completedBy,
              }
            : item,
        ),
      );
      setDayHistory(
        await apiFetch<AgendaDayHistoryItem[]>(
          `/api/admin/agendas/${agenda.id}/history`,
        ),
      );
    } catch {
      setMessage("Não foi possível reabrir o dia.");
    } finally {
      setReopening(false);
    }
  }

  async function openHistory(appointmentId: string) {
    setMessage(null);

    try {
      const items = await apiFetch<AppointmentHistoryItem[]>(
        `/api/admin/appointments/${appointmentId}/history`,
      );
      setHistory(items);
      setHistoryAppointmentId(appointmentId);
    } catch {
      setMessage("Não foi possível consultar o histórico de status.");
    }
  }

  return (
    <section className="admin-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Administração</span>
          <h1>Histórico</h1>
          <p>Consulte agendas anteriores e a trilha de alterações de status.</p>
        </div>
      </header>

      <form className="filter-bar" onSubmit={filter}>
        <label>
          <span>Loja</span>
          <select value={storeCode} onChange={(event) => setStoreCode(event.target.value)}>
            <option value="">Todas</option>
            {stores.map((store) => (
              <option key={store.id} value={store.codigo}>
                {store.codigo} - {store.nome}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Data</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? "Consultando..." : "Filtrar"}
        </button>
      </form>

      {message ? <p className="form-error">{message}</p> : null}

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Loja</th>
                <th>Total</th>
                <th>Aguardando</th>
                <th>Recebidos</th>
                <th>Status do dia</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {agendas.map((agenda) => (
                <tr key={agenda.id}>
                  <td>{formatDate(agenda.date)}</td>
                  <td>{agenda.storeName}</td>
                  <td>{agenda.total}</td>
                  <td>{agenda.aguardando}</td>
                  <td>{agenda.recebido}</td>
                  <td>
                    <span className={`status-pill ${agenda.dayStatus === "concluido" ? "success" : "warning"}`}>
                      {agenda.dayStatus === "concluido" ? "Concluído" : "Em aberto"}
                    </span>
                  </td>
                  <td className="table-action">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => void openAgenda(agenda.id)}
                    >
                      Abrir agenda
                    </button>
                  </td>
                </tr>
              ))}
              {agendas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    Use os filtros para consultar agendas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {detail ? (
        <section className="detail-panel">
          <div className="section-heading">
            <div>
              <h2>{detail.agenda.storeCode} - {detail.agenda.storeName}</h2>
              <p>{formatDate(detail.agenda.date)}</p>
              <span className={`status-pill ${detail.agenda.dayStatus === "concluido" ? "success" : "warning"}`}>
                {detail.agenda.dayStatus === "concluido" ? "Concluído" : "Em aberto"}
              </span>
            </div>
            {detail.agenda.dayStatus === "concluido" ? (
              <button
                className="primary-button"
                type="button"
                disabled={reopening}
                onClick={() => void reopenForStore()}
              >
                {reopening ? "Reabrindo..." : "Reabrir para conferente"}
              </button>
            ) : null}
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Protocolo</th>
                  <th>Fornecedor</th>
                  <th>Status</th>
                  <th>Trocas</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {detail.appointments.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{appointment.startTime} - {appointment.endTime}</td>
                    <td>{appointment.protocol}</td>
                    <td>{appointment.supplier}</td>
                    <td>
                      <select
                        aria-label={`Status de ${appointment.supplier}`}
                        value={appointment.status}
                        disabled={savingAppointmentId === appointment.id}
                        onChange={(event) =>
                          void changeAppointmentStatus(
                            appointment.id,
                            event.target.value as AdminAppointment["status"],
                          )
                        }
                      >
                        <option value="aguardando">Aguardando</option>
                        <option value="recebido">Recebido</option>
                        <option value="nao_chegou">Não recebido</option>
                        <option value="recusado">Recusado</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Trocas de ${appointment.supplier}`}
                        checked={appointment.hasExchanges}
                        disabled={savingAppointmentId === appointment.id}
                        onChange={(event) =>
                          void changeAppointmentExchanges(
                            appointment.id,
                            event.target.checked,
                          )
                        }
                      />
                    </td>
                    <td className="table-action">
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => void openHistory(appointment.id)}
                      >
                        Ver histórico
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="history-box">
            <h3>Histórico do dia</h3>
            {dayHistory.length ? (
              <ul>
                {dayHistory.map((item) => (
                  <li key={item.id}>
                    <strong>
                      {item.action === "concluido"
                        ? "Dia concluído"
                        : item.action === "reaberto"
                          ? "Dia reaberto"
                          : "Ajuste administrativo"}
                    </strong>
                    <span>
                      {item.user.name}
                      {item.details ? ` · ${item.details}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhum evento registrado para o dia.</p>
            )}
          </div>

          {historyAppointmentId ? (
            <div className="history-box">
              <h3>Histórico de status</h3>
              {history.length ? (
                <ul>
                  {history.map((item) => (
                    <li key={item.id}>
                      <strong>{item.statusAnterior} → {item.statusNovo}</strong>
                      <span>{item.usuario.nome}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>Nenhuma alteração registrada.</p>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
