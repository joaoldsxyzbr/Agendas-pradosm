import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { AgendaDetails } from "./AgendaDetails";
import { AgendaList } from "./AgendaList";
import type {
  StoreAgenda,
  StoreAgendaSummary,
  StoreAppointment,
} from "./types";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function countStatus(
  appointments: StoreAppointment[],
  status: StoreAppointment["status"],
) {
  return appointments.filter((appointment) => appointment.status === status).length;
}

export function HistoryPage() {
  const [days, setDays] = useState<StoreAgendaSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<StoreAgenda | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedAppointmentId(null);
    setSearchQuery("");
    setLoadingAgenda(true);
    setError(null);

    try {
      setAgenda(
        await apiFetch<StoreAgenda>(
          `/api/store/history/${date}`,
        ),
      );
    } catch {
      setAgenda(null);
      setError("Não foi possível abrir a agenda selecionada.");
    } finally {
      setLoadingAgenda(false);
    }
  }

  useEffect(() => {
    let active = true;

    void apiFetch<StoreAgendaSummary[]>("/api/store/history")
      .then((data) => {
        if (!active) return;

        const sorted = [...data].sort((a, b) => b.date.localeCompare(a.date));
        setDays(sorted);

        if (sorted[0]) {
          void selectDate(sorted[0].date);
        }
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar o histórico.");
      })
      .finally(() => {
        if (active) setLoadingDays(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const appointments = useMemo(
    () =>
      [...(agenda?.appointments ?? [])].sort(
        (a, b) =>
          a.startTime.localeCompare(b.startTime) ||
          a.protocol.localeCompare(b.protocol),
      ),
    [agenda],
  );

  const filteredAppointments = useMemo(() => {
    const query = normalizeSearch(searchQuery);
    if (!query) return appointments;

    return appointments.filter((appointment) =>
      normalizeSearch(`${appointment.supplier} ${appointment.protocol}`).includes(query),
    );
  }, [appointments, searchQuery]);

  const total = appointments.length;
  const aguardando = countStatus(appointments, "aguardando");
  const recebido = countStatus(appointments, "recebido");
  const naoChegou = countStatus(appointments, "nao_chegou");
  const recusado = countStatus(appointments, "recusado");

  return (
    <section className="store-page history-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Recebimento</span>
          <h1>Histórico</h1>
          <p>Consulte rapidamente as agendas anteriores da loja.</p>
        </div>
      </header>

      {loadingDays ? <p className="muted-state">Carregando histórico...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loadingDays && days.length === 0 ? (
        <div className="empty-panel">Nenhuma agenda anterior disponível.</div>
      ) : null}

      {days.length ? (
        <section className="history-days-panel" aria-label="Agendas anteriores">
          <div className="history-days-heading">
            <strong>Dias disponíveis</strong>
            <span>{days.length} {days.length === 1 ? "dia" : "dias"}</span>
          </div>

          <div className="history-day-list" aria-label="Dias disponíveis">
            {days.map((day) => (
              <button
                key={day.id}
                type="button"
                className={selectedDate === day.date ? "history-day active" : "history-day"}
                aria-pressed={selectedDate === day.date}
                onClick={() => void selectDate(day.date)}
              >
                <strong>{formatDate(day.date)}</strong>
                <span>{day.total} {day.total === 1 ? "agendamento" : "agendamentos"}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {loadingAgenda ? <p className="muted-state">Abrindo agenda...</p> : null}

      {agenda?.agenda && !loadingAgenda ? (
        <section className="history-overview">
          <div className="history-toolbar">
            <div className="selected-day-heading">
              <strong>{formatDate(agenda.agenda.date)}</strong>
              <span>{agenda.agenda.storeCode} - {agenda.agenda.storeName}</span>
            </div>

            <label className="agenda-search history-search">
              <span className="sr-only">Pesquisar fornecedor ou protocolo</span>
              <input
                type="search"
                value={searchQuery}
                aria-label="Pesquisar fornecedor ou protocolo"
                placeholder="Pesquisar fornecedor ou protocolo"
                autoComplete="off"
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
          </div>

          <section className="store-summary history-summary" aria-label="Resumo da agenda">
            <div><strong>{total} {total === 1 ? "agendamento" : "agendamentos"}</strong><span>Total</span></div>
            <div><strong>{aguardando} aguardando</strong><span>Pendentes</span></div>
            <div><strong>{recebido} {recebido === 1 ? "recebido" : "recebidos"}</strong><span>Recebidos</span></div>
            <div><strong>{naoChegou} {naoChegou === 1 ? "não chegou" : "não chegaram"}</strong><span>Ausentes</span></div>
            <div><strong>{recusado} {recusado === 1 ? "recusado" : "recusados"}</strong><span>Recusados</span></div>
          </section>

          {filteredAppointments.length > 0 ? (
            <AgendaList
              appointments={filteredAppointments}
              onOpen={setSelectedAppointmentId}
              editable={false}
            />
          ) : (
            <div className="empty-panel agenda-search-empty">
              Nenhum fornecedor ou protocolo encontrado neste dia.
            </div>
          )}

          <AgendaDetails
            appointmentId={selectedAppointmentId}
            onClose={() => setSelectedAppointmentId(null)}
          />
        </section>
      ) : null}
    </section>
  );
}
