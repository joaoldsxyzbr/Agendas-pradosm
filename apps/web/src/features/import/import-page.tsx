import { useState } from "react";
import { PageHeader } from "@/components/operations/page-header";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { ImportAgendaDialog } from "./import-agenda-dialog";

export function ImportPage() {
  const [opened, setOpened] = useState(false);
  return <section className="mx-auto w-full min-w-0 max-w-[1530px] space-y-4" aria-label="Importação de Agendas">
    <PageHeader eyebrow="Administração" title="Importação de Agendas"
      description="Importe o CSV/PDF uma única vez. Recebimento e Conferência seguem com os dados operacionais atuais; Agendas exibe os campos completos." />
    <div className="flex flex-col items-start gap-3 rounded-xl border border-[#38516d] bg-[#162740] p-6">
      <FileSpreadsheet className="text-sky-300" size={28} aria-hidden="true" />
      <h2 className="text-base font-bold">Importação única para todas as lojas</h2>
      <p className="max-w-xl text-sm text-slate-300">Selecione o arquivo, confira a prévia e confirme. O sistema distribui os registros para as respectivas lojas automaticamente, sem necessidade de importar novamente para o conferente.</p>
      <Button onClick={() => setOpened(true)}>Selecionar arquivo CSV/PDF</Button>
    </div>
    {opened && <ImportAgendaDialog onClose={() => setOpened(false)} />}
  </section>;
}
