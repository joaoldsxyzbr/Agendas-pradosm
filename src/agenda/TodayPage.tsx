import { useEffect, useMemo, useState } from "react";
import { businessDate } from "../../shared/time";
import { ApiError, apiFetch } from "../lib/api";
import { AgendaDatePicker } from "./AgendaDatePicker";
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
  const [manualEditing, setManualEditing] = useState<StoreAppointment | null>(null);
  const [manualDeleteTarget, setManualDeleteTarget] = useState<StoreAppointment | null>(null);
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
    setManualEditing(null);
    setManualDeleteTarget(null);
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
    setManualEditing(null);
    setManualSupplier("");
    setManualError(null);
    setManualOpen(true);
  }

  function editManualSupplier(appointment: StoreAppointment) {
    setManualEditing(appointment);
    setManualSupplier(appointment.supplier);
    setManualError(null);
    setManualOpen(true);
  }

  function closeManualSupplier() {
    if (manualSaving) return;
    setManualOpen(false);
    setManualEditing(null);
    setManualSupplier("");
    setManualError(null);
  }

  function openManualDeleteFromEdit() {
    if (!manualEditing || manualSaving) return;
    setManualDeleteTarget(manualEditing);
    setManualOpen(false);
    setManualError(null);
  }

  function cancelManualDelete() {
    if (manualSaving) return;
    setManualDeleteTarget(null);
    if (manualEditing) setManualOpen(true);
  }

  async function addManualSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supplier = manualSupplier.trim();
    if (!supplier || manualSaving || !isEditable) return;

    setManualSaving(true);
    setManualError(null);

    try {
      const saved = await apiFetch<StoreAppointment>(
        manualEditing
          ? `/api/store/appointments/${manualEditing.id}/manual`
          : `/api/store/agenda/${selectedDate}/manual`,
        {
          method: manualEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplier }),
        },
      );

      setAgenda((current) => {
        if (!current) return current;
        return {
          ...current,
          appointments: manualEditing
            ? current.appointments.map((appointment) =>
                appointment.id === saved.id ? saved : appointment,
              )
            : [...current.appointments, saved],
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

  async function deleteManualSupplier() {
    if (!manualDeleteTarget || !isEditable || manualSaving) return;

    setManualSaving(true);
    setManualError(null);
    try {
      await apiFetch<void>(
        `/api/store/appointments/${manualDeleteTarget.id}/manual`,
        { method: "DELETE" },
      );
      setAgenda((current) =>
        current
          ? {
              ...current,
              appointments: current.appointments.filter(
                (appointment) => appointment.id !== manualDeleteTarget.id,
              ),
            }
          : current,
      );
      setManualDeleteTarget(null);
      setManualOpen(false);
      setManualEditing(null);
      setManualSupplier("");
    } catch (caught) {
      setManualError(
        caught instanceof ApiError
          ? caught.message
          : "Não foi possível remover o fornecedor.",
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
  const trocas = appointments.filter((appointment) => appointment.hasExchanges).length;

  return (
    <section className="store-page">
      <h1 className="sr-only">Agenda de recebimento</h1>

      <section className="agenda-command-bar" aria-label="Selecionar dia da agenda">
        <div className="agenda-date-controls">
          <button
            className="ghost-button agenda-date-step"
            type="button"
            aria-label="Dia anterior"
            onClick={() => setSelectedDate((current) => addDays(current, -1))}
          >
            ‹
          </button>

          <AgendaDatePicker
            value={selectedDate}
            today={today}
            onChange={setSelectedDate}
          />

          <button
            className="ghost-button agenda-date-step"
            type="button"
            aria-label="Dia seguinte"
            onClick={() => setSelectedDate((current) => addDays(current, 1))}
          >
            ›
          </button>
        </div>

        <div className="agenda-command-actions">
          <span
            className={`agenda-day-chip ${
              !agenda?.agenda
                ? "empty"
                : isEditable
                  ? "open"
                  : "closed"
            }`}
          >
            {!agenda?.agenda
              ? "Sem agenda"
              : isEditable
                ? "Em aberto"
                : "Concluído"}
          </span>

          {!isToday ? (
            <button
              className="ghost-button agenda-today-button"
              type="button"
              onClick={() => setSelectedDate(today)}
            >
              Hoje
            </button>
          ) : null}

          {agenda?.agenda && isEditable ? (
            <button
              className="primary-button agenda-complete-button"
              type="button"
              onClick={() => setCompleteConfirmOpen(true)}
            >
              Concluir dia
            </button>
          ) : null}

          {agenda?.agenda ? (
            <button
              className="ghost-button agenda-export-button"
              type="button"
              onClick={exportPdf}
            >
              Exportar PDF
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

          <section className="agenda-metrics" aria-label="Resumo da agenda">
            <span><strong>{total}</strong> total</span>
            <span><strong>{aguardando}</strong> aguardando</span>
            <span><strong>{recebido}</strong> recebidos</span>
            <span><strong>{naoChegou}</strong> não recebidos</span>
            <span><strong>{trocas}</strong> trocas</span>
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
                className="ghost-button agenda-manual-button"
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
              onEditManual={isEditable ? editManualSupplier : undefined}
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

      {manualDeleteTarget && isEditable ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card manual-supplier-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-manual-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Recebimento</span>
                <h2 id="delete-manual-title">Remover fornecedor</h2>
              </div>
            </div>
            <p>
              Remover {manualDeleteTarget.supplier}? O registro ficará preservado
              no histórico de auditoria.
            </p>
            {manualError ? <p className="form-error">{manualError}</p> : null}
            <div className="modal-actions">
              <button
                className="ghost-button"
                type="button"
                disabled={manualSaving}
                onClick={cancelManualDelete}
              >
                Cancelar
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={manualSaving}
                onClick={() => void deleteManualSupplier()}
              >
                {manualSaving ? "Removendo..." : "Remover"}
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
                <h2 id="manual-supplier-title">
                  {manualEditing ? "Editar fornecedor" : "Fornecedor sem agenda"}
                </h2>
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

              <div
                className="modal-actions"
                style={manualEditing ? { justifyContent: "space-between", gap: "0.75rem" } : undefined}
              >
                {manualEditing ? (
                  <button
                    className="danger-button"
                    style={{ marginRight: "auto" }}
                    type="button"
                    onClick={openManualDeleteFromEdit}
                    disabled={manualSaving}
                  >
                    Remover
                  </button>
                ) : null}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem" }}>
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
                    {manualSaving
                      ? manualEditing
                        ? "Salvando..."
                        : "Adicionando..."
                      : manualEditing
                        ? "Salvar"
                        : "Adicionar"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
