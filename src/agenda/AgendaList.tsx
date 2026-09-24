import { StatusControl, STATUS_LABELS } from "./StatusControl";
import type { StoreAppointment } from "./types";

export function AgendaList({
  appointments,
  onOpen,
  onChanged,
  editable = true,
}: {
  appointments: StoreAppointment[];
  onOpen: (appointmentId: string) => void;
  onChanged?: (appointment: StoreAppointment) => void;
  editable?: boolean;
}) {
  const sorted = [...appointments].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.protocol.localeCompare(b.protocol),
  );

  function statusCell(appointment: StoreAppointment) {
    if (editable && onChanged) {
      return (
        <StatusControl
          appointmentId={appointment.id}
          status={appointment.status}
          onChanged={onChanged}
        />
      );
    }

    return (
      <span className={`store-status status-${appointment.status}`}>
        {STATUS_LABELS[appointment.status]}
      </span>
    );
  }

  return (
    <>
      <div className="agenda-desktop table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Horário</th>
                <th>Fornecedor</th>
                <th>Protocolo</th>
                <th>Tipo</th>
                <th>Status</th>
                <th><span className="sr-only">Ações</span></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((appointment) => (
                <tr key={appointment.id} data-testid="agenda-desktop-row">
                  <td>{appointment.startTime} - {appointment.endTime}</td>
                  <td>{appointment.supplier}</td>
                  <td>{appointment.protocol}</td>
                  <td>{appointment.type ?? "-"}</td>
                  <td>{statusCell(appointment)}</td>
                  <td className="table-action">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onOpen(appointment.id)}
                    >
                      Ver detalhes
                    </button>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
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
                <strong>{appointment.startTime} - {appointment.endTime}</strong>
                <span>{appointment.supplier}</span>
              </div>
              <span className="protocol-chip">{appointment.protocol}</span>
            </div>

            <div className="agenda-card-meta">
              <span>{appointment.type ?? "Tipo não informado"}</span>
            </div>

            {statusCell(appointment)}

            <button
              className="ghost-button agenda-detail-button"
              type="button"
              onClick={() => onOpen(appointment.id)}
            >
              Ver detalhes
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
