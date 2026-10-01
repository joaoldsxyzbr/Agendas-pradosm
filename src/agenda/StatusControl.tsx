import { useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import type { AppointmentStatus, StoreAppointment } from "./types";

const STATUS_OPTIONS: Array<{
  value: AppointmentStatus;
  label: string;
  symbol: string;
}> = [
  { value: "recebido", label: "Recebido", symbol: "✓" },
  { value: "nao_chegou", label: "Não recebido", symbol: "✕" },
];

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  aguardando: "Aguardando",
  recebido: "Recebido",
  nao_chegou: "Não recebido",
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
    if (saving) return;

    const requestedStatus =
      nextStatus === status ? "aguardando" : nextStatus;

    setSaving(nextStatus);
    setError(null);

    try {
      const updated = await apiFetch<StoreAppointment>(
        `/api/store/appointments/${appointmentId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: requestedStatus }),
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
            title={
              option.value === status
                ? "Voltar para aguardando"
                : `Marcar como ${option.label.toLowerCase()}`
            }
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

export function ExchangeCheckbox({
  appointmentId,
  hasExchanges,
  onChanged,
}: {
  appointmentId: string;
  hasExchanges: boolean;
  onChanged: (appointment: StoreAppointment) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function changeExchanges(nextValue: boolean) {
    if (saving || nextValue === hasExchanges) return;

    setSaving(true);
    setError(null);

    try {
      const updated = await apiFetch<StoreAppointment>(
        `/api/store/appointments/${appointmentId}/exchanges`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hasExchanges: nextValue }),
        },
      );
      onChanged(updated);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Não foi possível alterar a marcação de trocas.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="exchange-control">
      <input
        type="checkbox"
        aria-label="Trocas"
        checked={hasExchanges}
        disabled={saving}
        onChange={(event) => void changeExchanges(event.target.checked)}
      />
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
