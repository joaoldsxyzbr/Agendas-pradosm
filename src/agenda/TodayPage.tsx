import { useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { AgendaDetails } from "./AgendaDetails";
import { AgendaList } from "./AgendaList";
import { downloadAgendaPdf } from "./exportAgendaPdf";
import type { StoreAgenda, StoreAppointment } from "./types";

function countStatus(
  appointments: StoreAppointment[],
  status: StoreAppointment["status"],
) {
  return appointments.filter((appointment) => appointment.status === status).length;
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

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

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatCompletion(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function TodayPage() {
  const [today] = useState(businessDate);
  const [selectedDate, setSelectedDate] = useState(today);
  const [agenda, setAgenda] = useState<StoreAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSupplier, setManualSupplier] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const isToday = selectedDate === today;
  const isEditable = agenda?.agenda?.dayStatus === "aberto";

  useEffect(() => {
    let active = true;

    setAgenda(null);
    setLoading(true);
    setError(null);
    setSearchQuery("");
    setSelectedAppointmentId(null);
    setManualOpen(false);
    setCompleteConfirmOpen(false);
    setCompleteError(null);

    const endpoint = isToday
      ? "/api/store/today"
      : `/api/store/history/${selectedDate}`;

    void apiFetch<StoreAgenda>(endpoint)
      .then((data) => {
        if (active) setAgenda(data);
      })
      .catch((loadError) => {
        if (!active) return;

        if (loadError instanceof ApiError && loadError.status === 404) {
          setAgenda({ agenda: null, appointments: [] });
          return;
        }

        setError("Não foi possível carregar a agenda selecionada.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isToday, selectedDate]);

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

  function openManualSupplier() {
    setManualSupplier("");
    setManualError(null);
    setManualOpen(true);
  }

  function closeManualSupplier() {
    if (manualSaving) return;
    setManualOpen(false);
    setManualSupplier("");
    setManualError(null);
  }

  async function addManualSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supplier = manualSupplier.trim();
    if (!supplier || manualSaving || !isEditable) return;

    setManualSaving(true);
    setManualError(null);

    try {
      const created = await apiFetch<StoreAppointment>(
        `/api/store/agenda/${selectedDate}/manual`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier }),
        },
      );

      setAgenda((current) => {
        if (!current) return current;
        return {
          ...current,
          appointments: [...current.appointments, created],
        };
      });
      setSearchQuery("");
      setManualOpen(false);
      setManualSupplier("");
    } catch (saveError) {
      setManualError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível adicionar o fornecedor.",
      );
    } finally {
      setManualSaving(false);
    }
  }

  function exportPdf() {
    if (!agenda?.agenda) return;
    downloadAgendaPdf(agenda.agenda, appointments);
  }

  function statusChanged(updated: StoreAppointment) {
    if (!isEditable) return;

    setAgenda((current) => {
      if (!current) return current;
      return {
        ...current,
        appointments: current.appointments.map((appointment) =>
          appointment.id === updated.id ? updated : appointment,
        ),
      };
    });
  }

  async function completeDay() {
    if (!agenda?.agenda || !isEditable || completing) return;

    setCompleting(true);
    setCompleteError(null);
    try {
      const updated = await apiFetch<NonNullable<StoreAgenda["agenda"]>>(
        `/api/store/agenda/${selectedDate}/complete`,
        { method: "POST" },
      );

      setAgenda((current) =>
        current ? { ...current, agenda: updated } : current,
      );
      setCompleteConfirmOpen(false);
    } catch (completeDayError) {
      setCompleteError(
        completeDayError instanceof ApiError
          ? completeDayError.message
          : "Não foi possível concluir o dia.",
      );
    } finally {
      setCompleting(false);
    }
  }

  const total = appointments.length;
  const aguardando = countStatus(appointments, "aguardando");
  const recebido = countStatus(appointments, "recebido");
  const naoChegou = countStatus(appointments, "nao_chegou");
  const recusado = countStatus(appointments, "recusado");

  return (
    <section className="store-page">
      <header className="page-heading page-heading-actions">
        <div>
          <span className="eyebrow">Recebimento</span>
          <h1>Agenda de recebimento</h1>
          <p>Selecione o dia e consulte a agenda da unidade.</p>
        </div>

        {agenda?.agenda ? (
          <button
            className="ghost-button agenda-export-button"
            type="button"
            onClick={exportPdf}
          >
            Exportar PDF
          </button>
        ) : null}
      </header>

      <section className="agenda-date-bar" aria-label="Selecionar dia da agenda">
        <div className="agenda-date-controls">
          <button
            className="ghost-button agenda-date-step"
            type="button"
            aria-label="Dia anterior"
            onClick={() => setSelectedDate((current) => addDays(current, -1))}
          >
            ‹
          </button>

          <label className="agenda-date-field">
            <span>Data da agenda</span>
            <input
              type="date"
              aria-label="Data da agenda"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </label>

          <button
            className="ghost-button agenda-date-step"
            type="button"
            aria-label="Dia seguinte"
            onClick={() => setSelectedDate((current) => addDays(current, 1))}
          >
            ›
          </button>
        </div>

        <div className="agenda-date-context">
          <div>
            <span>{isToday ? "Hoje" : "Agenda"}</span>
            <strong>{formatDate(selectedDate)}</strong>
            <small>
              {agenda?.agenda
                ? isEditable
                  ? "Em aberto"
                  : "Concluído"
                : "Sem agenda"}
            </small>
          </div>

          {agenda?.agenda && isEditable ? (
            <button
              className="primary-button"
              type="button"
              onClick={() => setCompleteConfirmOpen(true)}
            >
              Concluir dia
            </button>
          ) : null}

          {!isToday ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() => setSelectedDate(today)}
            >
              Voltar para hoje
            </button>
          ) : null}
        </div>
      </section>

      {loading ? <p className="muted-state">Carregando agenda...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading && !error && agenda?.agenda === null ? (
        <div className="empty-panel store-empty">
          <strong>
            {isToday
              ? "Nenhuma agenda para hoje."
              : `Nenhuma agenda em ${formatDate(selectedDate)}.`}
          </strong>
          <span>
            {isToday
              ? "Quando a administração importar a agenda do dia, ela aparecerá aqui."
              : "Escolha outra data para consultar os recebimentos."}
          </span>
        </div>
      ) : null}

      {!loading && !error && agenda?.agenda ? (
        <>
          {!isEditable && agenda.agenda.completedAt ? (
            <div className="agenda-completed-banner">
              <strong>Dia concluído</strong>
              <span>
                {agenda.agenda.completedBy?.name ?? "Usuário"} em{" "}
                {formatCompletion(agenda.agenda.completedAt)}
              </span>
            </div>
          ) : null}

          <section className="store-summary" aria-label="Resumo da agenda">
            <div><strong>{total} {total === 1 ? "agendamento" : "agendamentos"}</strong><span>Total</span></div>
            <div><strong>{aguardando} aguardando</strong><span>Pendentes</span></div>
            <div><strong>{recebido} {recebido === 1 ? "recebido" : "recebidos"}</strong><span>Recebidos</span></div>
            <div><strong>{naoChegou} {naoChegou === 1 ? "não recebido" : "não recebidos"}</strong><span>Ausentes</span></div>
            <div><strong>{recusado} {recusado === 1 ? "recusado" : "recusados"}</strong><span>Recusados</span></div>
          </section>

          <div className="agenda-toolbar">
            <label className="agenda-search">
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

            {isEditable ? (
              <button
                className="primary-button agenda-manual-button"
                type="button"
                onClick={openManualSupplier}
              >
                + Fornecedor sem agenda
              </button>
            ) : null}
          </div>

          {filteredAppointments.length > 0 ? (
            <AgendaList
              appointments={filteredAppointments}
              onChanged={isEditable ? statusChanged : undefined}
              onOpen={!isEditable ? setSelectedAppointmentId : undefined}
              editable={isEditable}
            />
          ) : (
            <div className="empty-panel agenda-search-empty">
              Nenhum fornecedor ou protocolo encontrado.
            </div>
          )}

          {!isEditable ? (
            <AgendaDetails
              appointmentId={selectedAppointmentId}
              onClose={() => setSelectedAppointmentId(null)}
            />
          ) : null}
        </>
      ) : null}

      {completeConfirmOpen && agenda?.agenda ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card manual-supplier-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-day-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Fechamento</span>
                <h2 id="complete-day-title">Concluir dia</h2>
              </div>
            </div>
            <p>
              Depois de concluir, a agenda ficará somente para consulta até que
              um administrador a reabra.
            </p>
            {completeError ? <p className="form-error">{completeError}</p> : null}
            <div className="modal-actions">
              <button
                className="ghost-button"
                type="button"
                disabled={completing}
                onClick={() => setCompleteConfirmOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={completing}
                onClick={() => void completeDay()}
              >
                {completing ? "Concluindo..." : "Concluir dia"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {manualOpen && isEditable && agenda?.agenda ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card manual-supplier-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="manual-supplier-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Recebimento</span>
                <h2 id="manual-supplier-title">Fornecedor sem agenda</h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={closeManualSupplier}
                disabled={manualSaving}
              >
                Fechar
              </button>
            </div>

            <form className="modal-form" onSubmit={addManualSupplier}>
              <label>
                Nome do fornecedor
                <input
                  type="text"
                  value={manualSupplier}
                  autoFocus
                  maxLength={160}
                  onChange={(event) => setManualSupplier(event.target.value)}
                />
              </label>

              {manualError ? <p className="form-error">{manualError}</p> : null}

              <div className="modal-actions">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={closeManualSupplier}
                  disabled={manualSaving}
                >
                  Cancelar
                </button>
                <button
                  className="primary-button"
                  type="submit"
                  disabled={manualSaving || !manualSupplier.trim()}
                >
                  {manualSaving ? "Adicionando..." : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
