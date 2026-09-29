import { useEffect, useMemo, useState } from "react";
import { AgendaList } from "../agenda/AgendaList";
import type { StoreAppointment } from "../agenda/types";
import { apiFetch } from "../lib/api";
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
  onClose,
  onAgendaChanged,
}: {
  agendaId: string;
  canReopen: boolean;
  onClose: () => void;
  onAgendaChanged?: () => void;
}) {
  const [detail, setDetail] = useState<AdminAgendaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSearchQuery("");

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

  async function reopenForStore() {
    if (
      !canReopen ||
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
          <section className="store-page admin-agenda-preview">
            <div className="agenda-preview-context">
              <div>
                <strong>{formatDate(detail.agenda.date)}</strong>
                <span>Visualização do conferente</span>
              </div>
              <div className="agenda-preview-status">
                {canReopen && detail.agenda.dayStatus === "concluido" ? (
                  <button
                    className="status-pill neutral agenda-preview-reopen"
                    type="button"
                    disabled={reopening}
                    onClick={() => void reopenForStore()}
                  >
                    {reopening ? "Reabrindo..." : "Reabrir para conferente"}
                  </button>
                ) : null}
                <span className="status-pill neutral">
                  {detail.agenda.dayStatus === "concluido"
                    ? "Concluído"
                    : "Em aberto"}
                </span>
                <span className="status-pill neutral">Somente leitura</span>
              </div>
            </div>

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
            </div>

            {filteredAppointments.length > 0 ? (
              <AgendaList
                appointments={filteredAppointments}
                editable={false}
              />
            ) : (
              <div className="empty-panel agenda-search-empty">
                Nenhum fornecedor ou protocolo encontrado.
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
