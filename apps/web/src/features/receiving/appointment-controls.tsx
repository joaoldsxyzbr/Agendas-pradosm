import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { StatusBadge } from "@/components/operations/status-badge";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import {
  changeAppointmentExchanges, changeAppointmentObservation, changeAppointmentStatus,
  type AppointmentStatus,
} from "./api";
import type { AgendaDetail } from "./model";

type Appointment = AgendaDetail["appointments"][number];
type Draft = { kind: "status" | "observation"; reason: string; custom: string };

const reasons = [
  "Sem agenda", "Sem pedido", "Sem boleto", "Prazo de pagamento incorreto",
  "Temperatura acima do OK", "Não veio",
] as const; // Mesmos motivos do contrato em shared/observations.js.
const statusInfo: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  aguardando: { label: "Aguardando", tone: "warning" },
  recebido: { label: "Recebido", tone: "success" },
  nao_chegou: { label: "Não recebido", tone: "danger" },
  recusado: { label: "Recusado", tone: "danger" },
};
type Change =
  | { kind: "status"; status: AppointmentStatus; observation: string | null }
  | { kind: "exchanges"; hasExchanges: boolean }
  | { kind: "observation"; observation: string | null };

function explanation(error: unknown) {
  return error instanceof ApiError ? error.message
    : error instanceof Error ? error.message : "Não foi possível salvar. Tente novamente.";
}

// Linha completa do agendamento na tabela do diálogo de detalhes, no mesmo
// formato da tela de Conferência: uma única linha física com as 8 células
// (Horário, Fornecedor, Protocolo, Tipo, Status, Ações, Trocas, Obs.).
// Motivo, observação e erro abrem em linha extra com colSpan 8 quando necessário.
// Botões de ícone compactos com nomes acessíveis preservados para os testes e2e.
export function AppointmentControls({ item, editable, disabled, onSaved, onBusyChange, extraActions }: {
  item: Appointment;
  editable: boolean;
  disabled: boolean;
  onSaved: () => Promise<void>;
  onBusyChange: (pending: boolean) => void;
  extraActions?: ReactNode;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState("");
  const mutation = useMutation({
    mutationFn: async (value: Change) => {
      if (value.kind === "status") return changeAppointmentStatus(item.id, value.status, value.observation);
      if (value.kind === "exchanges") return changeAppointmentExchanges(item.id, value.hasExchanges);
      return changeAppointmentObservation(item.id, value.observation);
    },
    onSuccess: async () => {
      await onSaved();
      setDraft(null);
      setFormError("");
    },
  });
  useEffect(() => {
    onBusyChange(mutation.isPending);
    return () => onBusyChange(false);
  }, [mutation.isPending, onBusyChange]);

  const status = statusInfo[item.status] ?? { label: item.status, tone: "neutral" as const };
  const rowBody = <>
    <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] tabular-nums text-slate-300">
      {item.startTime || item.endTime ? <>{item.startTime}{item.endTime ? "–" + item.endTime : ""}</> : "—"}
    </td>
    <td className="px-2.5 py-1.5">
      <div className="flex items-center gap-1.5">
        <strong className="min-w-0 truncate text-xs text-slate-50" title={item.supplier}>{item.supplier}</strong>
        {item.origin === "manual" && <span className="shrink-0 text-[10px] text-sky-300">Fornecedor sem agenda</span>}
      </div>
    </td>
    <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] tabular-nums text-slate-400" title={`Protocolo ${item.protocol}`}>{item.protocol}</td>
    <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] text-slate-400">{item.type ?? "—"}</td>
    <td className="whitespace-nowrap px-2.5 py-1.5">
      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
    </td>
  </>;

  if (!editable) return <tbody data-testid={`detail-row-${item.id}`} className="border-b border-[#2c4258] last:border-0">
    <tr className="align-middle">
      {rowBody}
      <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px] text-slate-500">—</td>
      <td className="whitespace-nowrap px-2.5 py-1.5 text-[11px]">
        <strong className={item.hasExchanges ? "text-emerald-300" : "text-slate-300"}>{item.hasExchanges ? "Sim" : "Não"}</strong>
      </td>
      <td className="w-[280px] min-w-[280px] max-w-[280px] px-2.5 py-1.5">
        {item.observation
          ? <span className="block w-[260px] max-w-full truncate whitespace-nowrap text-[11px] text-amber-300"
              title={item.observation}>Obs.: {item.observation}</span>
          : <span className="text-[11px] text-slate-500">—</span>}
      </td>
    </tr>
  </tbody>;

  const blocked = disabled || mutation.isPending;
  const openNote = (kind: Draft["kind"]) => {
    if (blocked) return;
    const note = item.observation ?? "";
    const preset = reasons.find(value => value === note);
    setDraft({
      kind,
      reason: preset ?? (note.startsWith("Outros: ") ? "Outros" : ""),
      custom: note.startsWith("Outros: ") ? note.slice(8) : "",
    });
    mutation.reset();
    setFormError("");
  };
  const saveNote = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || blocked) return;
    const required = draft.kind === "status" || item.status === "nao_chegou";
    const note = draft.reason === "Outros"
      ? (draft.custom.trim() ? "Outros: " + draft.custom.trim().replace(/\s+/g, " ") : "")
      : draft.reason;
    if ((required && !note) || (draft.reason === "Outros" && !draft.custom.trim())) {
      setFormError("Selecione um motivo ou preencha o motivo personalizado.");
      return;
    }
    if (note.length > 250) {
      setFormError("A observação deve ter até 250 caracteres.");
      return;
    }
    mutation.mutate(draft.kind === "status"
      ? { kind: "status", status: "nao_chegou", observation: note }
      : { kind: "observation", observation: note || null });
  };
  const setStatus = (value: "recebido" | "nao_chegou") => {
    if (blocked) return;
    if (item.status === value) {
      mutation.mutate({ kind: "status", status: "aguardando", observation: null });
    } else if (value === "nao_chegou") {
      openNote("status");
    } else {
      mutation.mutate({ kind: "status", status: value, observation: null });
    }
  };

  return <tbody data-testid={`detail-row-${item.id}`} className="border-b border-[#2c4258] last:border-0">
    <tr className="align-middle">
      {rowBody}
      <td className="w-[148px] min-w-[148px] px-2.5 py-1.5">
        <div className="flex w-max flex-nowrap items-center gap-1">
          <div role="group" aria-label={`Alterar status de ${item.supplier}`} className="flex flex-nowrap gap-1">
            <Button size="icon" className="h-7 w-7" variant={item.status === "recebido" ? "default" : "secondary"}
              disabled={blocked} aria-pressed={item.status === "recebido"}
              title={item.status === "recebido" ? "Desmarcar recebido" : "Marcar como recebido"}
              aria-label={item.status === "recebido" ? "Desmarcar recebido" : "Recebido"}
              onClick={() => setStatus("recebido")}>
              <Check size={15} aria-hidden="true" />
            </Button>
            <Button size="icon" className="h-7 w-7" variant={item.status === "nao_chegou" ? "danger" : "secondary"}
              disabled={blocked} aria-pressed={item.status === "nao_chegou"}
              title={item.status === "nao_chegou" ? "Desmarcar não recebido" : "Marcar como não recebido"}
              aria-label={item.status === "nao_chegou" ? "Desmarcar não recebido" : "Não recebido"}
              onClick={() => setStatus("nao_chegou")}>
              <X size={15} aria-hidden="true" />
            </Button>
          </div>
          {extraActions}
        </div>
      </td>
      <td className="px-2.5 py-1.5">
        <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-200">
          <input type="checkbox" aria-label={`Trocas de ${item.supplier}`} checked={Boolean(item.hasExchanges)}
            disabled={blocked} onChange={event => mutation.mutate({ kind: "exchanges", hasExchanges: event.target.checked })}
            className="size-4 accent-sky-500" />Trocas
        </label>
      </td>
      <td className="w-[280px] min-w-[280px] max-w-[280px] px-2.5 py-1.5">
        <div className="flex w-[260px] max-w-full items-center gap-1.5 whitespace-nowrap">
          {item.observation && <span className="min-w-0 flex-1 truncate whitespace-nowrap text-[11px] text-amber-300"
            title={item.observation}>Obs.: {item.observation}</span>}
          <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-[11px]" disabled={blocked}
            aria-label={`Observação de ${item.supplier}`} onClick={() => openNote("observation")}>
            {item.observation ? "Editar observação" : "+ Obs."}
          </Button>
          {!item.observation && <span className="text-[11px] text-slate-500">—</span>}
        </div>
      </td>
    </tr>
    {(mutation.isError || draft) && <tr>
      <td colSpan={8} className="px-2.5 pb-2.5">
        {mutation.isError && <p role="alert" className="mb-2 text-xs text-rose-300">{explanation(mutation.error)}</p>}
        {draft && <form onSubmit={saveNote} className="space-y-2 rounded-md border border-[#46647c] bg-[#203650] p-2.5">
          <p className="text-xs font-semibold text-slate-100">{draft.kind === "status" ? "Motivo de não recebimento" : "Observação"} — {item.supplier}</p>
          <label className="block text-[11px] text-slate-300" htmlFor={`reason-${item.id}`}>
            Motivo {draft.kind === "status" || item.status === "nao_chegou" ? "(obrigatório)" : "(opcional)"}
          </label>
          <select id={`reason-${item.id}`} aria-label={`Motivo de ${item.supplier}`}
            value={draft.reason} disabled={blocked} onChange={event => {
              setDraft({ ...draft, reason: event.target.value }); setFormError("");
            }} className="h-9 w-full rounded-md border border-slate-600 bg-[#101e30] px-2 text-xs text-white">
            <option value="">Sem observação</option>
            {reasons.map(reason => <option key={reason} value={reason}>{reason}</option>)}
            <option value="Outros">Personalizado</option>
          </select>
          {draft.reason === "Outros" && <label className="block space-y-1 text-[11px] text-slate-300">
            Descreva o motivo
            <textarea rows={2} maxLength={242} required disabled={blocked} value={draft.custom}
              onChange={event => { setDraft({ ...draft, custom: event.target.value }); }}
              className="w-full rounded-md border border-slate-600 bg-[#101e30] px-2 py-1.5 text-xs text-white" />
          </label>}
          {formError && <p role="alert" className="text-xs text-rose-300">{formError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={blocked}>{mutation.isPending ? "Salvando…" : "Confirmar"}</Button>
            <Button size="sm" variant="secondary" disabled={blocked} onClick={() => { setDraft(null); setFormError(""); mutation.reset(); }}>Cancelar</Button>
          </div>
        </form>}
      </td>
    </tr>}
  </tbody>;
}
