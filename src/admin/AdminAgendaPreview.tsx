import { useEffect, useMemo, useState } from "react";
import { AgendaList } from "../agenda/AgendaList";
import type { StoreAppointment } from "../agenda/types";
import { apiFetch } from "../lib/api";
import { useRealtimeEvent } from "../realtime/useRealtimeConnection";
import type { AdminAgendaDetail, AdminAppointment } from "./types";

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

function toStoreAppointment(appointment: AdminAppointment): StoreAppointment {
  return {
    id: appointment.id,
    protocol: appointment.protocol,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    supplier: appointment.supplier,
    items: appointment.items ?? null,
    volumes: appointment.volumes ?? null,
    pallets: appointment.pallets ?? null,
    cargaBatida: appointment.cargaBatida ?? null,
    type: appointment.type ?? null,
    nfe: appointment.nfe,
    orders: appointment.orders,
    status: appointment.status,
    hasExchanges: appointment.hasExchanges,
    origin: appointment.origin,
    ativo: appointment.ativo,
  };
}

export function AdminAgendaPreview({
  agendaId,
  canReopen,
  canEdit,
  onClose,
  onAgendaChanged,
}: {
  agendaId: string;
  canReopen: boolean;
  canEdit: boolean;
  onClose: () => void;
  onAgendaChanged?: () => void;
}) {
  const [detail, setDetail] = useState<AdminAgendaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reopening, setReopening] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEditing, setManualEditing] = useState<StoreAppointment | null>(null);
  const [manualSupplier, setManualSupplier] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualDeleting, setManualDeleting] = useState<StoreAppointment | null>(null);
  const [manualDeleteSaving, setManualDeleteSaving] = useState(false);
  const [manualDeleteError, setManualDeleteError] = useState<string | null>(null);

  useRealtimeEvent((event) => {
    if (event.type !== "agenda.changed" || event.agendaId !== agendaId) return;

    void apiFetch<AdminAgendaDetail>(`/api/admin/agendas/${agendaId}`)
      .then((data) => setDetail(data))
      .catch(() => {
        // O detalhe atual permanece disponível; o botão Atualizar continua como fallback.
      });
  }, [agendaId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSearchQuery("");
    setEditMode(false);
    setManualOpen(false);
    setManualEditing(null);
    setManualSupplier("");
    setManualError(null);
    setManualDeleting(null);
    setManualDeleteSaving(false);
    setManualDeleteError(null);

    void apiFetch<AdminAgendaDetail>(`/api/admin/agendas/${agendaId}`)
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => {
        if (active) {
          setError("Não foi possível carregar os detalhes desta agenda.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [agendaId]);

  const appointments = useMemo(
    () => (detail?.appointments ?? []).map(toStoreAppointment),
    [detail],
  );

  const filteredAppointments = useMemo(() => {
    const query = normalizeSearch(searchQuery);
    if (!query) return appointments;

    return appointments.filter((appointment) =>
      normalizeSearch(
        `${appointment.supplier} ${appointment.protocol}`,
      ).includes(query),
    );
  }, [appointments, searchQuery]);

  const total = appointments.length;
  const aguardando = appointments.filter(
    (appointment) => appointment.status === "aguardando",
  ).length;
  const recebido = appointments.filter(
    (appointment) => appointment.status === "recebido",
  ).length;
  const naoChegou = appointments.filter(
    (appointment) => appointment.status === "nao_chegou",
  ).length;
  const trocas = appointments.filter(
    (appointment) => appointment.hasExchanges,
  ).length;

  function appointmentChanged(updated: StoreAppointment) {
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
    onAgendaChanged?.();
  }

  function openManualSupplier() {
    if (!canEdit || !editMode) return;
    setManualEditing(null);
    setManualSupplier("");
    setManualError(null);
    setManualOpen(true);
  }

  function editManualSupplier(appointment: StoreAppointment) {
    if (!canEdit || !editMode) return;
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

  function requestDeleteManual(appointment: StoreAppointment) {
    if (!canEdit || !editMode || appointment.origin !== "manual") return;
    setManualDeleting(appointment);
    setManualDeleteError(null);
  }

  function closeDeleteManual() {
    if (manualDeleteSaving) return;
    setManualDeleting(null);
    setManualDeleteError(null);
  }

  async function deleteManualSupplier() {
    if (!canEdit || !editMode || !manualDeleting || manualDeleteSaving) return;

    setManualDeleteSaving(true);
    setManualDeleteError(null);

    try {
      await apiFetch<void>(
        `/api/admin/appointments/${manualDeleting.id}/manual`,
        { method: "DELETE" },
      );

      setDetail((current) =>
        current
          ? {
              ...current,
              appointments: current.appointments.filter(
                (appointment) => appointment.id !== manualDeleting.id,
              ),
            }
          : current,
      );
      setManualDeleting(null);
      onAgendaChanged?.();
    } catch (caught) {
      setManualDeleteError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível excluir o fornecedor.",
      );
    } finally {
      setManualDeleteSaving(false);
    }
  }

  function toggleEditMode() {
    if (!canEdit || manualSaving) return;

    if (editMode) {
      setManualOpen(false);
      setManualEditing(null);
      setManualSupplier("");
      setManualError(null);
      setManualDeleting(null);
      setManualDeleteError(null);
    }

    setEditMode(!editMode);
  }

  async function saveManualSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !editMode || manualSaving) return;

    const supplier = manualSupplier.trim();
    if (!supplier) return;

    setManualSaving(true);
    setManualError(null);

    try {
      const saved = await apiFetch<StoreAppointment>(
        manualEditing
          ? `/api/admin/appointments/${manualEditing.id}/manual`
          : `/api/admin/agendas/${agendaId}/manual`,
        {
          method: manualEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplier }),
        },
      );

      if (manualEditing) {
        appointmentChanged(saved);
      } else {
        setDetail((current) =>
          current
            ? {
                ...current,
                appointments: [...current.appointments, saved],
              }
            : current,
        );
        onAgendaChanged?.();
      }

      setManualOpen(false);
      setManualEditing(null);
      setManualSupplier("");
      setSearchQuery("");
    } catch (caught) {
      setManualError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível salvar o fornecedor.",
      );
    } finally {
      setManualSaving(false);
    }
  }

  async function reopenForStore() {
    if (
      !canReopen ||
      !editMode ||
      !detail ||
      reopening ||
      detail.agenda.dayStatus !== "concluido"
    ) {
      return;
    }

    setReopening(true);
    setError(null);

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
      onAgendaChanged?.();
    } catch {
      setError("Não foi possível reabrir o dia para o conferente.");
    } finally {
      setReopening(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="modal-card agenda-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-agenda-preview-title"
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">Consulta</span>
            <h2 id="admin-agenda-preview-title">
              {detail
                ? `Agenda ${detail.agenda.storeCode} - ${detail.agenda.storeName}`
                : "Detalhes da agenda"}
            </h2>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        {loading ? <p className="muted-state">Carregando agenda...</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        {!loading && !error && detail ? (
          <section
            className={`store-page admin-agenda-preview ${
              detail.agenda.dayStatus === "concluido"
                ? "is-completed"
                : "is-open"
            }`}
          >
            <div className="agenda-preview-context">
              <div>
                <strong>{formatDate(detail.agenda.date)}</strong>
                <span>Visualização do conferente</span>
              </div>
              <div className="agenda-preview-status">
                {canReopen && editMode && detail.agenda.dayStatus === "concluido" ? (
                  <button
                    className="status-pill warning agenda-preview-reopen"
                    type="button"
                    disabled={reopening}
                    onClick={() => void reopenForStore()}
                  >
                    {reopening ? "Reabrindo..." : "Reabrir para conferente"}
                  </button>
                ) : null}
                <span
                  className={`status-pill agenda-preview-day-status ${
                    detail.agenda.dayStatus === "concluido"
                      ? "success"
                      : "warning"
                  }`}
                >
                  {detail.agenda.dayStatus === "concluido"
                    ? "✓ Concluído"
                    : "Em andamento"}
                </span>
                {canEdit ? (
                  <button
                    className={editMode ? "primary-button" : "ghost-button"}
                    type="button"
                    aria-pressed={editMode}
                    onClick={toggleEditMode}
                  >
                    {editMode ? "Sair da edição" : "Editar agenda"}
                  </button>
                ) : null}
                <span className="status-pill muted">
                  {canEdit && editMode ? "Modo edição" : "Somente leitura"}
                </span>
              </div>
            </div>

            <section className="agenda-metrics" aria-label="Resumo da agenda">
              <span className="agenda-metric agenda-metric-total">
                <strong>{total}</strong> total
              </span>
              <span className="agenda-metric agenda-metric-pending">
                <strong>{aguardando}</strong> aguardando
              </span>
              <span className="agenda-metric agenda-metric-success">
                <strong>{recebido}</strong> recebidos
              </span>
              <span className="agenda-metric agenda-metric-danger">
                <strong>{naoChegou}</strong> não recebidos
              </span>
              <span className="agenda-metric agenda-metric-exchange">
                <strong>{trocas}</strong> trocas
              </span>
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

              {canEdit && editMode ? (
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
                editable={canEdit && editMode}
                onChanged={canEdit && editMode ? appointmentChanged : undefined}
                onEditManual={canEdit && editMode ? editManualSupplier : undefined}
                onDeleteManual={canEdit && editMode ? requestDeleteManual : undefined}
                appointmentApiBase="/api/admin/appointments"
                highlightPositiveExchanges
              />
            ) : (
              <div className="empty-panel agenda-search-empty">
                Nenhum fornecedor ou protocolo encontrado.
              </div>
            )}
          </section>
        ) : null}
      </div>

      {canEdit && editMode && manualDeleting ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card manual-supplier-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-manual-delete-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Confirmação</span>
                <h2 id="admin-manual-delete-title">Excluir fornecedor</h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                disabled={manualDeleteSaving}
                onClick={closeDeleteManual}
              >
                Fechar
              </button>
            </div>

            <p>
              Excluir <strong>{manualDeleting.supplier}</strong> desta agenda?
            </p>
            <p className="muted-state">
              A remoção fica registrada na auditoria.
            </p>

            {manualDeleteError ? (
              <p className="form-error">{manualDeleteError}</p>
            ) : null}

            <div className="modal-actions">
              <button
                className="ghost-button"
                type="button"
                disabled={manualDeleteSaving}
                onClick={closeDeleteManual}
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={manualDeleteSaving}
                onClick={() => void deleteManualSupplier()}
              >
                {manualDeleteSaving ? "Excluindo..." : "Excluir fornecedor"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canEdit && editMode && manualOpen ? (
        <div className="modal-backdrop" role="presentation">
          <div
            className="modal-card manual-supplier-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-manual-supplier-title"
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Ajuste administrativo</span>
                <h2 id="admin-manual-supplier-title">
                  {manualEditing ? "Editar fornecedor" : "Fornecedor sem agenda"}
                </h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                disabled={manualSaving}
                onClick={closeManualSupplier}
              >
                Fechar
              </button>
            </div>

            <form className="modal-form" onSubmit={saveManualSupplier}>
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
                  disabled={manualSaving}
                  onClick={closeManualSupplier}
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
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
