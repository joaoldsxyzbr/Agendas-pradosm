import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { publishAviso } from "./api";
import { expiraEmFromInput, publicarAvisoSchema } from "./model";

// Diálogo de publicação de aviso, aberto pelo botão "Novo aviso" do sino.
// Mesmo padrão de <dialog> nativo do import-agenda-dialog.
export function PublishAvisoDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [expira, setExpira] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => { if (dialog.open) dialog.close(); };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const parsed = publicarAvisoSchema.safeParse({
      titulo,
      mensagem,
      expiraEm: expiraEmFromInput(expira),
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

  return <dialog ref={ref} aria-labelledby="publish-aviso-heading"
    onCancel={event => { if (submitting) { event.preventDefault(); return; } onClose(); }}
    onClick={event => { if (event.target === ref.current && !submitting) onClose(); }}
    className="m-auto w-[min(94vw,560px)] max-w-none rounded-xl border border-[#45617c] bg-[#162538] p-0 text-slate-100 shadow-2xl backdrop:bg-black/75">
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
          aria-label="Título do aviso" disabled={submitting}
          className="w-full rounded-md border border-[#3b5876] bg-[#17283d] px-3 py-2 text-sm text-slate-100 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-400" />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-300">Mensagem</span>
        <textarea value={mensagem} onChange={event => setMensagem(event.target.value)} required maxLength={2000} rows={4}
          aria-label="Mensagem do aviso" disabled={submitting}
          className="w-full resize-y rounded-md border border-[#3b5876] bg-[#17283d] px-3 py-2 text-sm text-slate-100 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-400" />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-semibold text-slate-300">Expira em (opcional)</span>
        <input type="date" value={expira} onChange={event => setExpira(event.target.value)}
          aria-label="Data de expiração do aviso" disabled={submitting}
          className="w-full rounded-md border border-[#3b5876] bg-[#17283d] px-3 py-2 text-sm text-slate-100 outline-offset-2 focus-visible:outline-2 focus-visible:outline-sky-400" />
        <span className="block text-[11px] text-slate-500">Sem data, o aviso fica visível até ser inativado. A expiração vale até o fim do dia escolhido (23h59 de Brasília).</span>
      </label>
      {error && <p role="alert" className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={submitting} onClick={onClose}>Cancelar</Button>
        <Button type="submit" size="sm" disabled={submitting}>{submitting ? "Publicando…" : "Publicar aviso"}</Button>
      </div>
    </form>
  </dialog>;
}
