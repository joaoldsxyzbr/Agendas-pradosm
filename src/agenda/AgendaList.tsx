import { useState } from "react";
import {
  ExchangeCheckbox,
  StatusActions,
  StatusBadge,
} from "./StatusControl";
import type { StoreAppointment } from "./types";

function appointmentTime(appointment: StoreAppointment) {
  return appointment.origin === "manual"
    ? appointment.startTime
    : `${appointment.startTime} - ${appointment.endTime}`;
}

type SortKey = "time" | "supplier" | "protocol" | "type" | "status";
type SortDirection = "asc" | "desc";
type SortState = { key: SortKey; direction: SortDirection } | null;

const collator = new Intl.Collator("pt-BR", {
  numeric: true,
  sensitivity: "base",
});

function defaultCompare(a: StoreAppointment, b: StoreAppointment) {
  return (
    a.startTime.localeCompare(b.startTime) ||
    a.protocol.localeCompare(b.protocol)
  );
}

function sortValue(appointment: StoreAppointment, key: SortKey) {
  switch (key) {
    case "time":
      return appointment.startTime;
    case "supplier":
      return appointment.supplier;
    case "protocol":
      return appointment.protocol;
    case "type":
      return appointment.type ?? "";
    case "status":
      return appointment.status;
  }
}

export function AgendaList({
  appointments,
  onOpen,
  onChanged,
  editable = true,
  onEditManual,
}: {
  appointments: StoreAppointment[];
  onOpen?: (appointmentId: string) => void;
  onChanged?: (appointment: StoreAppointment) => void;
  editable?: boolean;
  onEditManual?: (appointment: StoreAppointment) => void;
}) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = [...appointments].sort((a, b) => {
    if (!sort) return defaultCompare(a, b);

    const comparison = collator.compare(sortValue(a, sort.key), sortValue(b, sort.key));
    if (comparison !== 0) return sort.direction === "asc" ? comparison : -comparison;
    return defaultCompare(a, b);
  });

  const hasActions = Boolean(
    onOpen || (editable && (onChanged || onEditManual)),
  );

  function cycleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "desc" };
      if (current.direction === "desc") return { key, direction: "asc" };
      return null;
    });
  }

  function sortableHeader(key: SortKey, label: string) {
    const active = sort?.key === key ? sort.direction : null;
    const ariaSort = active === "asc" ? "ascending" : active === "desc" ? "descending" : "none";

    return (
      <th aria-sort={ariaSort}>
        <button
          className="agenda-sort-button"
          type="button"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: 0, border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: "inherit", letterSpacing: "inherit", textTransform: "inherit", cursor: "pointer" }}
          title={`Ordenar por ${label}`}
          onClick={() => cycleSort(key)}
        >
          <span>{label}</span>
          <span className="agenda-sort-icon" aria-hidden="true" style={{ minWidth: "0.8rem", fontSize: "0.9rem", lineHeight: 1 }}>
            {active === "desc" ? "↓" : active === "asc" ? "↑" : ""}
          </span>
        </button>
      </th>
    );
  }

  function exchangeControl(appointment: StoreAppointment) {
    if (!editable || !onChanged) return null;

    return (
      <ExchangeCheckbox
        appointmentId={appointment.id}
        hasExchanges={appointment.hasExchanges}
        onChanged={onChanged}
      />
    );
  }

  function actions(appointment: StoreAppointment) {
    return (
      <div className="agenda-row-actions">
        {editable && onChanged ? (
          <StatusActions
            appointmentId={appointment.id}
            status={appointment.status}
            onChanged={onChanged}
          />
        ) : null}

        {editable && appointment.origin === "manual" && onEditManual ? (
          <button
            className="ghost-button agenda-manual-edit-action"
            type="button"
            style={{ width: 34, height: 34, minHeight: 34, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            aria-label={`Editar fornecedor ${appointment.supplier}`}
            title="Editar fornecedor"
            onClick={() => onEditManual(appointment)}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              style={{ width: 15, height: 15, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}
            >
              <path d="M4 20h4l10.6-10.6a2.1 2.1 0 0 0-4-3L4 17v3Zm9.2-12.2 3 3" />
            </svg>
          </button>
        ) : null}

        {onOpen ? (
          <button
            className="ghost-button agenda-detail-button"
            type="button"
            onClick={() => onOpen(appointment.id)}
          >
            Ver detalhes
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div className="agenda-desktop table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {sortableHeader("time", "Horário")}
                {sortableHeader("supplier", "Fornecedor")}
                {sortableHeader("protocol", "Protocolo")}
                {sortableHeader("type", "Tipo")}
                {sortableHeader("status", "Status")}
                {hasActions ? <th>Ações</th> : null}
                <th>Trocas</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((appointment) => (
                <tr key={appointment.id} data-testid="agenda-desktop-row">
                  <td>{appointmentTime(appointment)}</td>
                  <td>{appointment.supplier}</td>
                  <td>{appointment.protocol}</td>
                  <td>{appointment.type ?? "-"}</td>
                  <td><StatusBadge status={appointment.status} /></td>
                  {hasActions ? (
                    <td className="table-action">{actions(appointment)}</td>
                  ) : null}
                  <td className="exchange-cell">
                    {editable && onChanged ? (
                      exchangeControl(appointment)
                    ) : (
                      <span className="exchange-readonly">
                        {appointment.hasExchanges ? "Sim" : "Não"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={hasActions ? 7 : 6} className="empty-cell">
                    Nenhum agendamento nesta agenda.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="agenda-mobile">
        {sorted.map((appointment) => (
          <article
            className="agenda-card"
            key={appointment.id}
            data-testid="agenda-mobile-card"
          >
            <div className="agenda-card-heading">
              <div>
                <strong>{appointmentTime(appointment)}</strong>
                <span>{appointment.supplier}</span>
              </div>
              <span className="protocol-chip">{appointment.protocol}</span>
            </div>

            <div className="agenda-card-meta">
              <span>{appointment.type ?? "Tipo não informado"}</span>
            </div>

            <StatusBadge status={appointment.status} />
            {hasActions ? actions(appointment) : null}
            <div className="agenda-card-exchanges">
              <span>Trocas</span>
              {editable && onChanged ? (
                exchangeControl(appointment)
              ) : (
                <strong>{appointment.hasExchanges ? "Sim" : "Não"}</strong>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
