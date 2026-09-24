import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api";
import type {
  AdminAgendaDetail,
  AdminAgendaSummary,
  AdminStore,
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

    try {
      setDetail(await apiFetch<AdminAgendaDetail>(`/api/admin/agendas/${id}`));
    } catch {
      setMessage("Não foi possível abrir a agenda.");
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
                  <td colSpan={6} className="empty-cell">
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
            </div>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Protocolo</th>
                  <th>Fornecedor</th>
                  <th>Status</th>
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
                      <span className="status-pill neutral">{appointment.status}</span>
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
