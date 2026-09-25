import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { AgendaDetails } from "./AgendaDetails";
import { AgendaList } from "./AgendaList";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      <header className="page-heading">
        <div>
          <span className="eyebrow">Recebimento</span>
          <h1>Agenda de hoje</h1>
          <p>Confira os horários e marque o resultado de cada recebimento.</p>
        </div>
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
              onOpen={setSelectedId}
              onChanged={statusChanged}
            />
          ) : (
            <div className="empty-panel agenda-search-empty">
              Nenhum fornecedor ou protocolo encontrado.
            </div>
          )}

          <AgendaDetails
            appointmentId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        </>
      ) : null}
    </section>
  );
}
