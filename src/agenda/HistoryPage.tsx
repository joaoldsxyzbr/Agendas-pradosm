import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { AgendaDetails } from "./AgendaDetails";
import { AgendaList } from "./AgendaList";
import type { StoreAgenda, StoreAgendaSummary } from "./types";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

export function HistoryPage() {
  const [days, setDays] = useState<StoreAgendaSummary[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [agenda, setAgenda] = useState<StoreAgenda | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [loadingDays, setLoadingDays] = useState(true);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void apiFetch<StoreAgendaSummary[]>("/api/store/history")
      .then((data) => {
        if (active) setDays(data);
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

  async function selectDate(date: string) {
    setSelectedDate(date);
    setSelectedAppointmentId(null);
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

  return (
    <section className="store-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Recebimento</span>
          <h1>Histórico</h1>
          <p>Consulte uma agenda anterior sem misturar os dias.</p>
        </div>
      </header>

      {loadingDays ? <p className="muted-state">Carregando histórico...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loadingDays && days.length === 0 ? (
        <div className="empty-panel">Nenhuma agenda anterior disponível.</div>
      ) : null}

      {days.length ? (
        <div className="history-day-list" aria-label="Dias disponíveis">
          {days.map((day) => (
            <button
              key={day.id}
              type="button"
              className={selectedDate === day.date ? "history-day active" : "history-day"}
              onClick={() => void selectDate(day.date)}
            >
              <strong>{formatDate(day.date)}</strong>
              <span>{day.total} {day.total === 1 ? "agendamento" : "agendamentos"}</span>
            </button>
          ))}
        </div>
      ) : null}

      {loadingAgenda ? <p className="muted-state">Abrindo agenda...</p> : null}

      {agenda?.agenda && !loadingAgenda ? (
        <>
          <div className="selected-day-heading">
            <strong>{formatDate(agenda.agenda.date)}</strong>
            <span>{agenda.agenda.storeCode} - {agenda.agenda.storeName}</span>
          </div>

          <AgendaList
            appointments={agenda.appointments}
            onOpen={setSelectedAppointmentId}
            editable={false}
          />

          <AgendaDetails
            appointmentId={selectedAppointmentId}
            onClose={() => setSelectedAppointmentId(null)}
          />
        </>
      ) : null}
    </section>
  );
}
