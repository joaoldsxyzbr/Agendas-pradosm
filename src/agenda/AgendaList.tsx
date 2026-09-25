import { StatusActions, StatusBadge } from "./StatusControl";
import type { StoreAppointment } from "./types";

function appointmentTime(appointment: StoreAppointment) {
  return appointment.origin === "manual"
    ? appointment.startTime
    : `${appointment.startTime} - ${appointment.endTime}`;
}

export function AgendaList({
  appointments,
  onOpen,
  onChanged,
  editable = true,
}: {
  appointments: StoreAppointment[];
  onOpen?: (appointmentId: string) => void;
  onChanged?: (appointment: StoreAppointment) => void;
  editable?: boolean;
}) {
  const sorted = [...appointments].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.protocol.localeCompare(b.protocol),
  );

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
                <th>Horário</th>
                <th>Fornecedor</th>
                <th>Protocolo</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Ações</th>
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
                  <td className="table-action">{actions(appointment)}</td>
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
                <strong>{appointmentTime(appointment)}</strong>
                <span>{appointment.supplier}</span>
              </div>
              <span className="protocol-chip">{appointment.protocol}</span>
            </div>

            <div className="agenda-card-meta">
              <span>{appointment.type ?? "Tipo não informado"}</span>
            </div>

            <StatusBadge status={appointment.status} />
            {actions(appointment)}
          </article>
        ))}
      </div>
    </>
  );
}
