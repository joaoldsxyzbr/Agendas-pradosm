import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { formatDay } from "@/features/receiving/model";
import {
  MAX_SOURCE_FILE_BYTES, canConfirmImport, importErrorLabel,
  isCsvAgenda, isPdfAgenda, parseSelectedFile, submitImport,
  type ImportPreview, type ImportResult,
} from "./import-model";

const labelCount = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;
const fileType = (file: File) => isCsvAgenda(file) ? "CSV" : "PDF";
const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const conflictLabels = (details: Record<string, unknown> | null): string => {
  const conflicts = Array.isArray(details?.conflicts) ? details.conflicts : [];
  const labels = conflicts.flatMap(item => {
    if (typeof item !== "object" || item === null) return [];
    const storeCode = (item as Record<string, unknown>).storeCode;
    const date = (item as Record<string, unknown>).date;
    if (typeof storeCode !== "string" || typeof date !== "string") return [];
    return [`${storeCode} em ${date.split("-").reverse().join("/")}`];
  });
  return labels.length ? `Já existe agenda para: ${labels.join(", ")}.` : "";
};

// Importação de agendas como popup aberto pelo botão "Importar agenda" da
// tela de Recebimento, igual ao fluxo do sistema legado (data-open-import).
export function ImportAgendaDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const sequence = useRef(0);
  const sending = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replacePending, setReplacePending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);
  useEffect(() => () => { sequence.current += 1; }, []);

  const selectFile = async (selected: File | null) => {
    if (sending.current) return;
    const token = ++sequence.current;
    setFile(selected); setPreview(null); setMessage(""); setSuccess(null);
    setReplacePending(false); setLoading(false);
    if (!selected) return;
    if (selected.size > MAX_SOURCE_FILE_BYTES) {
      setMessage("O arquivo excede o limite de 10 MB."); return;
    }
    if (selected.size === 0) {
      setMessage("O arquivo está vazio. Selecione um CSV ou PDF com dados."); return;
    }
    if (!isCsvAgenda(selected) && !isPdfAgenda(selected)) {
      setMessage("Selecione um arquivo CSV ou PDF."); return;
    }
    setLoading(true);
    try {
      const parsed = await parseSelectedFile(selected);
      if (token !== sequence.current) return;
      setPreview(parsed);
      if (parsed.blockingErrors.length) {
        setMessage("O arquivo foi lido, mas precisa de correções. Confira os erros da prévia.");
      }
    } catch {
      if (token !== sequence.current) return;
      setMessage(isCsvAgenda(selected)
        ? "Não foi possível ler o CSV selecionado."
        : "Não foi possível ler o PDF selecionado.");
    } finally {
      if (token === sequence.current) setLoading(false);
    }
  };

  const importData = async (replace: boolean) => {
    if (!canConfirmImport(file, preview, sending.current) || !file || !preview || success) return;
    sending.current = true;
    setSubmitting(true); setMessage("");
    try {
      const result = await submitImport(file, preview, replace);
      setSuccess(result);
      setReplacePending(false);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["receiving"] }),
        client.invalidateQueries({ queryKey: ["agendas-board"] }),
        client.invalidateQueries({ queryKey: ["agenda-suppliers"] }),
      ]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setReplacePending(true);
        setMessage(conflictLabels(error.details) || "Já existe agenda para uma ou mais lojas e datas deste arquivo.");
      } else if (error instanceof ApiError && error.status === 422) {
        const missing = stringList(error.details?.stores);
        setMessage(missing.length
          ? `Lojas do arquivo não cadastradas ou inativas: ${missing.join(", ")}. Cadastre-as na tela Lojas ou corrija o arquivo e tente novamente.`
          : error.message);
      } else {
        setMessage(error instanceof ApiError ? error.message : "Não foi possível importar as agendas.");
      }
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = ""; // permite reenviar o mesmo arquivo
    void selectFile(chosen);
  };
  const onDragOver = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files")) return;
    event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true);
  };
  const onDrop = (event: DragEvent<HTMLElement>) => {
    if (!Array.from(event.dataTransfer.types).includes("Files") && !event.dataTransfer.files.length) return;
    event.preventDefault(); setDragging(false);
    if (sending.current) return;
    if (event.dataTransfer.files.length !== 1) {
      ++sequence.current; setFile(null); setPreview(null); setReplacePending(false);
      setLoading(false); setSuccess(null);
      setMessage("Arraste apenas um arquivo CSV ou PDF por vez.");
      return;
    }
    void selectFile(event.dataTransfer.files[0] ?? null);
  };
  const rows = preview?.agendas.flatMap(agenda =>
    agenda.appointments.map(item => ({ storeCode: agenda.storeCode, item }))) ?? [];
  const ready = canConfirmImport(file, preview, submitting) && !success;

  return <dialog ref={ref} aria-labelledby="import-agenda-heading"
    onCancel={event => { if (submitting) { event.preventDefault(); return; } onClose(); }}
    onClick={event => { if (event.target === ref.current && !submitting) onClose(); }}
    className="m-auto max-h-[min(92dvh,900px)] w-[min(94vw,1100px)] max-w-none overflow-y-auto rounded-xl border border-[#45617c] bg-[#162538] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#34516d] bg-[#1a2b40] px-4 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Agenda diária</p>
        <h2 id="import-agenda-heading" className="text-base font-bold">Importar agenda</h2>
      </div>
      <Button aria-label="Fechar importação" size="icon" variant="secondary" disabled={submitting}
        onClick={onClose}><X size={17} /></Button>
    </div>
    <div className="space-y-4 p-4">
      <div role="group" aria-label="Área para arrastar arquivos de agenda"
        onDragEnter={event => { if (Array.from(event.dataTransfer.types).includes("Files")) setDragging(true); }}
        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDragOver={onDragOver} onDrop={onDrop}
        className={`rounded-xl border border-dashed p-5 shadow-lg transition-colors ${dragging ? "border-sky-300 bg-[#264566]" : "border-[#3b5876] bg-[#17283d]"}`}>
        <div className="flex flex-wrap items-center gap-4">
          <div aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-lg bg-sky-500/10 text-sky-300"><Upload size={20}/></div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-100">Arquivo CSV ou PDF</h3>
            <p className="mt-1 text-xs text-slate-400">Arraste um arquivo aqui ou selecione no computador. Limite de 10 MB.</p>
            <p aria-live="polite" className="mt-2 break-all text-[11px] text-slate-300">{file?.name ?? "Nenhum arquivo selecionado"}</p>
          </div>
          <input ref={fileInput} type="file" accept=".csv,text/csv,.pdf,application/pdf"
            aria-label="Arquivo CSV ou PDF" className="sr-only" onChange={onFileChange} disabled={submitting}/>
          <Button size="sm" variant="secondary" disabled={submitting} onClick={() => fileInput.current?.click()}>
            <FileSpreadsheet size={14}/>Selecionar arquivo
          </Button>
        </div>
        <p className="mt-3 text-[11px] text-slate-400">Nenhuma agenda é gravada até você conferir a prévia e confirmar.</p>
      </div>
      {loading && <p role="status" className="rounded-lg border border-[#3b5876] bg-[#17283d] p-3 text-xs text-slate-300">Lendo arquivo…</p>}
      {message && <p role={preview?.blockingErrors.length ? "alert" : "status"}
        className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">{message}</p>}
      {success && <section role="status" aria-label="Importação concluída" className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
        <CheckCircle2 className="shrink-0 text-emerald-300" size={20}/>
        <div className="flex-1">
          <strong className="text-sm text-emerald-200">Importação concluída</strong>
          <p className="text-xs text-emerald-100">{labelCount(success.totalAgendas, "loja", "lojas")} e {labelCount(success.totalAppointments, "agendamento", "agendamentos")}.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onClose}>Ver Recebimento</Button>
      </section>}
      {preview && !loading && <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Resumo da prévia">
          <ImportMetric label="Lojas" value={labelCount(preview.agendas.length, "loja", "lojas")}/>
          <ImportMetric label="Data" value={preview.date ? formatDay(preview.date) : "Data não identificada"}/>
          <ImportMetric label="Total" value={labelCount(preview.totalAppointments, "agendamento", "agendamentos")}/>
        </div>
        {!!preview.blockingErrors.length && <section role="alert" aria-label="Erros da importação" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3">
          <h3 className="flex items-center gap-2 text-xs font-bold text-rose-200"><AlertTriangle size={15}/>Corrija antes de importar</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-rose-200">
            {preview.blockingErrors.map((error, i) => <li key={i}>{importErrorLabel(error)}</li>)}
          </ul>
        </section>}
        {!!preview.warnings.length && <section aria-label="Avisos da importação" className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <h3 className="text-xs font-bold text-amber-200">Avisos</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200">
            {preview.warnings.map((warning, i) => <li key={i}>{warning}</li>)}
          </ul>
        </section>}
        <div className="overflow-hidden rounded-xl border border-[#38516d] bg-[#142235]">
          <div className="flex items-center gap-2 border-b border-[#38516d] bg-[#21374f] px-3 py-2.5">
            <FileText size={15} className="text-sky-300"/><h3 className="text-xs font-bold text-slate-100">Prévia dos agendamentos</h3>
            <span className="ml-auto text-[11px] text-slate-400">{file ? fileType(file) : ""}</span>
          </div>
          <div className="w-full overflow-x-auto" data-testid="import-table-scroll">
            <table className="w-full min-w-[830px] border-collapse text-left text-xs" aria-label="Prévia de agendamentos">
              <thead className="bg-[#1c3047] text-[11px] text-slate-300">
                <tr>{["Loja","Horário","Protocolo","Fornecedor","Itens","Volumes","Tipo"].map(name =>
                  <th key={name} className="px-3 py-2 font-semibold">{name}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[#304865]">
                {rows.length ? rows.map(({storeCode,item},i) => <tr key={i} className="hover:bg-[#29405a]">
                  <td className="px-3 py-2">{storeCode ?? "—"}</td>
                  <td className="px-3 py-2">{item.startTime} - {item.endTime}</td>
                  <td className="px-3 py-2">{item.protocol}</td>
                  <td className="px-3 py-2">{item.supplier}</td>
                  <td className="px-3 py-2">{item.items ?? "-"}</td>
                  <td className="px-3 py-2">{item.volumes ?? "-"}</td>
                  <td className="px-3 py-2">{item.type}</td>
                </tr>) : <tr><td className="p-4 text-center text-slate-400" colSpan={7}>Nenhum agendamento interpretado.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        {!success && <div className="flex flex-wrap items-center justify-end gap-2">
          <Button disabled={!ready} onClick={() => void importData(false)}>{submitting ? "Importando…" : "Confirmar importação"}</Button>
        </div>}
        {replacePending && !success && <section role="alert" aria-label="Confirmar substituição" className="rounded-lg border border-amber-500/50 bg-[#332b23] p-4">
          <h3 className="text-sm font-bold text-amber-200">Há agendas já existentes</h3>
          <p className="mt-1 text-xs text-slate-300">A substituição atualiza somente os dados importados e preserva status, histórico e fornecedores adicionados manualmente.</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button size="sm" variant="secondary" disabled={submitting} onClick={() => setReplacePending(false)}>Cancelar</Button>
            <Button size="sm" variant="danger" disabled={!ready} onClick={() => void importData(true)}>Substituir agendas existentes</Button>
          </div>
        </section>}
      </div>}
    </div>
  </dialog>;
}

function ImportMetric({label,value}:{label:string;value:string}) {
  return <div className="flex min-h-[68px] flex-col justify-center rounded-lg border border-[#38516d] bg-[#1a2c42] px-3 py-2">
    <span className="text-[11px] text-slate-400">{label}</span>
    <strong className="mt-0.5 text-sm font-bold text-white">{value}</strong>
  </div>;
}
