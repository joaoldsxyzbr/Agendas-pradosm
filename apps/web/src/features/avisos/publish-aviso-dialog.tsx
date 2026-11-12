import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { getStores } from "@/features/receiving/api";
import { publishAviso } from "./api";
import { publicarAvisoSchema } from "./model";

// Diálogo de publicação de aviso, aberto pelo botão "Novo aviso" do sino.
// Mesmo padrão de <dialog> nativo do import-agenda-dialog. O aviso é
// registro permanente (sem expiração); a urgência e o público por loja
// são as melhorias de 12/11.
export function PublishAvisoDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [modo, setModo] = useState<"todas" | "escolher">("todas");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const lojas = useQuery({ queryKey: ["avisos", "stores"], queryFn: getStores, staleTime: 60_000 });

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  const toggleLoja = (codigo: string) => {
    setSelecionadas(current =>
      current.includes(codigo) ? current.filter(c => c !== codigo) : [...current, codigo]
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (modo === "escolher" && selecionadas.length === 0) {
      setError("Selecione ao menos uma loja.");
      return;
    }
    const parsed = publicarAvisoSchema.safeParse({
      titulo,
      mensagem,
      urgente,
      lojas: modo === "escolher" ? [...selecionadas].sort() : null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os campos do aviso.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await publishAviso(parsed.data);
      await client.invalidateQueries({ queryKey: ["avisos"] });
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível publicar o aviso.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = "w-full rounded-md border border-[#3b5876] bg-[#17283d] px-3 py-2 text-sm text-slate-100 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-400";

  return <dialog ref={ref} aria-labelledby="publish-aviso-heading"
    onCancel={event => { if (submitting) { event.preventDefault(); return; } onClose(); }}
    onClick={event => { if (event.target === ref.current && !submitting) onClose(); }}
    className="m-auto max-h-[min(94dvh,860px)] w-[min(94vw,560px)] max-w-none overflow-y-auto rounded-xl border border-[#45617c] bg-[#162538] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#34516d] bg-[#1a2b40] px-4 py-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-400">Avisos</p>
        <h2 id="publish-aviso-heading" className="text-base font-bold">Novo aviso</h2>
      </div>
      <Button aria-label="Fechar publicação de aviso" size="icon" variant="secondary" disabled={submitting}
        onClick={onClose}><X size={17} /></Button>
    </div>
    <form className="space-y-4 p-4" onSubmit={submit}>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-300">Título</span>
        <input value={titulo} onChange={event => setTitulo(event.target.value)} required maxLength={200}
          aria-label="Título do aviso" disabled={submitting} className={inputCls} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-300">Mensagem</span>
        <textarea value={mensagem} onChange={event => setMensagem(event.target.value)} required maxLength={2000} rows={4}
          aria-label="Mensagem do aviso" disabled={submitting} className={`${inputCls} resize-y`} />
      </label>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-300">
        <input type="checkbox" checked={urgente} onChange={event => setUrgente(event.target.checked)}
          className="size-4 accent-rose-500" aria-label="Aviso urgente" disabled={submitting} />
        Urgente (destaca o aviso e faz o badge do sino pulsar em vermelho)
      </label>
      <fieldset className="block space-y-1.5">
        <legend className="text-xs font-semibold text-slate-300">Público</legend>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" size="sm" variant={modo === "todas" ? "default" : "secondary"}
            aria-pressed={modo === "todas"} disabled={submitting}
            onClick={() => setModo("todas")}>Todas as lojas</Button>
          <Button type="button" size="sm" variant={modo === "escolher" ? "default" : "secondary"}
            aria-pressed={modo === "escolher"} disabled={submitting}
            onClick={() => setModo("escolher")}>Escolher lojas</Button>
        </div>
        {modo === "escolher" && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Lojas destinatárias">
            {(lojas.data ?? []).map(store => (
              <Button key={store.id} type="button" size="sm" className="h-7 px-2"
                variant={selecionadas.includes(store.codigo) ? "default" : "secondary"}
                aria-pressed={selecionadas.includes(store.codigo)}
                title={store.nome} disabled={submitting}
                onClick={() => toggleLoja(store.codigo)}>{store.codigo}</Button>
            ))}
            {selecionadas.length === 0 && <p className="w-full text-[11px] text-amber-300">Selecione ao menos uma loja.</p>}
          </div>
        )}
      </fieldset>
      <p className="rounded-md border border-[#34516d] bg-[#12213a] px-3 py-2 text-[11px] text-slate-400">
        O aviso fica registrado permanentemente: nunca é excluído, apenas marcado como lido. A lista de avisos é o histórico completo, visível a todas as lojas destinatárias.
      </p>
      {error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={submitting} onClick={onClose}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={submitting || !titulo.trim() || !mensagem.trim() || (modo === "escolher" && selecionadas.length === 0)}>
          {submitting ? "Publicando…" : "Publicar aviso"}</Button>
      </div>
    </form>
  </dialog>;
}
