import { PageHeader } from "@/components/operations/page-header";
import { StatusBadge } from "@/components/operations/status-badge";
import { Button } from "@/components/ui/button";

export function PlaceholderPage({ title, description }: {
  title: string;
  description: string;
}) {
  return <section className="mx-auto max-w-6xl space-y-4">
    <PageHeader eyebrow="Modernização controlada" title={title} description={description} />
    <div className="rounded-xl border border-[#304b6b] bg-[#142338] p-5 shadow-lg">
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone="warning">Em migração</StatusBadge>
        <span className="text-xs text-slate-400">Esta tela ainda funciona somente na versão atual do sistema.</span>
      </div>
      <h2 className="mt-5 text-base font-semibold text-white">Componente de teste da nova interface</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
        O layout, a autenticação e a navegação já estão funcionando na base React.
        Os dados e as operações reais serão migrados tela a tela, sem alterar o backend.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button size="sm" disabled>Operações indisponíveis nesta etapa</Button>
        <StatusBadge tone="success">Tema compacto</StatusBadge>
        <StatusBadge tone="neutral">Dados reais não carregados</StatusBadge>
      </div>
    </div>
  </section>;
}
