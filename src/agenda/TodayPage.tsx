import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
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

export function TodayPage() {
  const [agenda, setAgenda] = useState<StoreAgenda | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSupplier, setManualSupplier] = useState("");
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void apiFetch<StoreAgenda>("/api/store/today")
      .then((data) => {
        if (active) setAgenda(data);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar a agenda de hoje.");
      })
      .finally(() => {
        if (active) setLoading(false);
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
    if (!supplier || manualSaving) return;

    setManualSaving(true);
    setManualError(null);

    try {
      const created = await apiFetch<StoreAppointment>("/api/store/today/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier }),
      });

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
    } catch (error) {
      setManualError(
        error instanceof Error
          ? error.message
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
          <h1>Agenda de hoje</h1>
          <p>Confira os horários e marque o resultado de cada recebimento.</p>
        </div>

        {agenda?.agenda ? (
          <div className="today-heading-actions">
            <button
              className="primary-button"
              type="button"
              onClick={openManualSupplier}
            >
              + Fornecedor sem agenda
            </button>
            <button
              className="ghost-button agenda-export-button"
              type="button"
              onClick={exportPdf}
            >
              Exportar PDF
            </button>
          </div>
        ) : null}
      </header>

      {loading ? <p className="muted-state">Carregando agenda...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {!loading && !error && agenda?.agenda === null ? (
        <div className="empty-panel store-empty">
          <strong>Nenhuma agenda para hoje.</strong>
          <span>Quando a administração importar a agenda do dia, ela aparecerá aqui.</span>
        </div>
      ) : null}

      {!loading && !error && agenda?.agenda ? (
        <>
          <section className="store-summary" aria-label="Resumo da agenda">
            <div><strong>{total} {total === 1 ? "agendamento" : "agendamentos"}</strong><span>Total</span></div>
            <div><strong>{aguardando} aguardando</strong><span>Pendentes</span></div>
            <div><strong>{recebido} {recebido === 1 ? "recebido" : "recebidos"}</strong><span>Recebidos</span></div>
            <div><strong>{naoChegou} {naoChegou === 1 ? "não chegou" : "não chegaram"}</strong><span>Ausentes</span></div>
            <div><strong>{recusado} {recusado === 1 ? "recusado" : "recusados"}</strong><span>Recusados</span></div>
          </section>

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

          {filteredAppointments.length > 0 ? (
            <AgendaList
              appointments={filteredAppointments}
              onChanged={statusChanged}
            />
          ) : (
            <div className="empty-panel agenda-search-empty">
              Nenhum fornecedor ou protocolo encontrado.
            </div>
          )}

        </>
      ) : null}
      {manualOpen && agenda?.agenda ? (
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
