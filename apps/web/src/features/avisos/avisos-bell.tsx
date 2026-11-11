import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, Megaphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/features/auth/session";
import { getAvisos, inativarAviso, markAvisoLido } from "./api";
import { formatAvisoStamp, type AvisosResponse } from "./model";
import { PublishAvisoDialog } from "./publish-aviso-dialog";

// Sino de avisos/notificações in-app do cabeçalho: badge de não lidos,
// lista com marcar-como-lido otimista e, para admin, publicar/inativar.
// Todos os papéis autenticados veem os avisos (spec 2026-11-11, decisão 3).
export function AvisosBell({ papel }: { papel: Role }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const isAdmin = papel === "admin";
  const avisos = useQuery({
    queryKey: ["avisos"],
    queryFn: getAvisos,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Fecha o painel ao clicar fora ou pressionar Escape (fora do <dialog>).
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const patchQuery = (patch: (current: AvisosResponse) => AvisosResponse) => {
    client.setQueryData<AvisosResponse>(["avisos"], current => (current ? patch(current) : current));
  };

  const marcarLido = useMutation({
    mutationFn: markAvisoLido,
    onMutate: async id => {
      await client.cancelQueries({ queryKey: ["avisos"] });
      const previous = client.getQueryData<AvisosResponse>(["avisos"]) ?? null;
      patchQuery(current => ({
        naoLidos: Math.max(0, current.naoLidos - (current.avisos.find(a => a.id === id)?.lido ? 0 : 1)),
        avisos: current.avisos.map(a => (a.id === id ? { ...a, lido: true } : a)),
      }));
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(["avisos"], context.previous);
    },
    onSettled: () => { void client.invalidateQueries({ queryKey: ["avisos"] }); },
  });

  const inativar = useMutation({
    mutationFn: inativarAviso,
    onMutate: async id => {
      await client.cancelQueries({ queryKey: ["avisos"] });
      const previous = client.getQueryData<AvisosResponse>(["avisos"]) ?? null;
      patchQuery(current => {
        const alvo = current.avisos.find(a => a.id === id);
        return {
          naoLidos: Math.max(0, current.naoLidos - (alvo && !alvo.lido ? 1 : 0)),
          avisos: current.avisos.filter(a => a.id !== id),
        };
      });
      return { previous };
    },
    onError: (_error, _id, context) => {
      if (context?.previous) client.setQueryData(["avisos"], context.previous);
    },
    onSettled: () => { void client.invalidateQueries({ queryKey: ["avisos"] }); },
  });

  const data = avisos.data;
  const naoLidos = data?.naoLidos ?? 0;
  const lista = data?.avisos ?? [];
  const ariaLabel = naoLidos > 0 ? `Avisos, ${naoLidos} não lidos` : "Avisos";

  return <div ref={root} className="relative">
    <Button variant="ghost" size="icon" aria-label={ariaLabel} aria-haspopup="true"
      aria-expanded={open} data-testid="avisos-bell" className="relative"
      onClick={() => setOpen(current => !current)}>
      <Bell size={16} aria-hidden="true" />
      {naoLidos > 0 && <span data-testid="avisos-badge"
        aria-hidden="true"
        className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
        {naoLidos > 99 ? "99+" : naoLidos}
      </span>}
    </Button>
    {open && <div data-testid="avisos-panel" role="dialog" aria-label="Avisos"
      className="absolute right-0 top-11 z-40 w-[min(92vw,420px)] overflow-hidden rounded-xl border border-[#45617c] bg-[#162538] text-slate-100 shadow-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-[#34516d] bg-[#1a2b40] px-4 py-2.5">
        <strong className="text-sm">Avisos</strong>
        {isAdmin && <Button size="sm" variant="secondary" onClick={() => setPublishing(true)}>
          <Megaphone size={14} aria-hidden="true" /> Novo aviso
        </Button>}
      </div>
      <div className="max-h-[min(60dvh,420px)] divide-y divide-[#304865] overflow-y-auto">
        {avisos.isError && <p role="alert" className="p-4 text-xs text-rose-300">Não foi possível carregar os avisos.</p>}
        {!avisos.isError && lista.length === 0 && (
          <p className="p-4 text-xs text-slate-400">Nenhum aviso no momento.</p>
        )}
        {lista.map(aviso => <article key={aviso.id}
          aria-label={aviso.titulo}
          className={aviso.lido ? "bg-[#162538] p-3.5" : "bg-sky-500/5 p-3.5"}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className={aviso.tipo === "evento"
                  ? "rounded bg-sky-500/15 px-1.5 py-0.5 font-semibold text-sky-300"
                  : "rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-300"}>
                  {aviso.tipo === "evento" ? "Evento" : "Aviso"}
                </span>
                {formatAvisoStamp(aviso.criadoEm)}
              </p>
              <h3 className="mt-1 text-sm font-bold text-slate-100">{aviso.titulo}</h3>
              <p className="mt-1 break-words text-xs text-slate-300">{aviso.mensagem}</p>
              {aviso.expiraEm && <p className="mt-1 text-[11px] text-slate-500">Expira em {formatAvisoStamp(aviso.expiraEm)}</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              {!aviso.lido && <Button size="sm" variant="secondary" aria-label={`Marcar aviso como lido: ${aviso.titulo}`}
                disabled={marcarLido.isPending} onClick={() => marcarLido.mutate(aviso.id)}>
                <Check size={13} aria-hidden="true" /> Lido
              </Button>}
              {isAdmin && <Button size="sm" variant="danger" aria-label={`Inativar aviso: ${aviso.titulo}`}
                disabled={inativar.isPending} onClick={() => inativar.mutate(aviso.id)}>
                <Trash2 size={13} aria-hidden="true" /> Inativar
              </Button>}
            </div>
          </div>
        </article>)}
      </div>
    </div>}
    {publishing && <PublishAvisoDialog onClose={() => setPublishing(false)} />}
  </div>;
}
