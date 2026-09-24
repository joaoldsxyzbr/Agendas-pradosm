import { useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AppointmentStatus, StoreAppointment } from "./types";

const STATUS_OPTIONS: Array<{ value: AppointmentStatus; label: string }> = [
  { value: "aguardando", label: "Aguardando" },
  { value: "recebido", label: "Recebido" },
  { value: "nao_chegou", label: "Não chegou" },
  { value: "recusado", label: "Recusado" },
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  aguardando: "Aguardando",
  recebido: "Recebido",
  nao_chegou: "Não chegou",
  recusado: "Recusado",
};

export function StatusControl({
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
    <div className="status-control">
      <span className={`store-status status-${status}`}>
        {STATUS_LABELS[status]}
      </span>

      <div className="status-actions" aria-label="Alterar status">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={option.value === status ? "status-action current" : "status-action"}
            aria-pressed={option.value === status}
            disabled={Boolean(saving)}
            onClick={() => void changeStatus(option.value)}
          >
            {saving === option.value ? "Salvando..." : option.label}
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
