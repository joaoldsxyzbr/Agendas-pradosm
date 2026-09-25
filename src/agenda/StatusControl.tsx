import { useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AppointmentStatus, StoreAppointment } from "./types";

const STATUS_OPTIONS: Array<{
  value: AppointmentStatus;
  label: string;
  symbol: string;
}> = [
  { value: "recebido", label: "Recebido", symbol: "✓" },
  { value: "nao_chegou", label: "Não chegou", symbol: "−" },
  { value: "recusado", label: "Recusado", symbol: "✕" },
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  aguardando: "Aguardando",
  recebido: "Recebido",
  nao_chegou: "Não chegou",
  recusado: "Recusado",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`store-status status-${status}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function StatusActions({
  appointmentId,
  status,
  onChanged,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  onChanged: (appointment: StoreAppointment) => void;
}) {
  const [saving, setSaving] = useState<AppointmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function changeStatus(nextStatus: AppointmentStatus) {
    if (saving || nextStatus === status) return;

    setSaving(nextStatus);
    setError(null);

    try {
      const updated = await apiFetch<StoreAppointment>(
        `/api/store/appointments/${appointmentId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      onChanged(updated);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Não foi possível alterar o status.",
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="status-actions-wrap">
      <div className="status-actions" aria-label="Alterar status">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              option.value === status
                ? `status-action status-action-${option.value} current`
                : `status-action status-action-${option.value}`
            }
            aria-label={option.label}
            title={option.label}
            aria-pressed={option.value === status}
            disabled={Boolean(saving)}
            onClick={() => void changeStatus(option.value)}
          >
            <span aria-hidden="true">
              {saving === option.value ? "…" : option.symbol}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function StatusControl({
  appointmentId,
  status,
  onChanged,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  onChanged: (appointment: StoreAppointment) => void;
}) {
  return (
    <div className="status-control">
      <StatusBadge status={status} />
      <StatusActions
        appointmentId={appointmentId}
        status={status}
        onChanged={onChanged}
      />
    </div>
  );
}
