import { escapeHtml } from "./shell.js";

export const REPORT_HELP = Object.freeze({
  "Agendamentos": "Quantidade total de agendamentos no período selecionado, incluindo todos os status.",
  "Recebidos": "Agendamentos marcados como recebidos. O percentual considera o total do período.",
  "Não recebidos": "Quantidade marcada como não recebida. Os motivos aparecem em Ocorrências e observações.",
  "Taxa de recebimento": "Recebidos ÷ total de agendamentos × 100. Os agendamentos pendentes também entram no total.",
  "Aguardando": "Agendamentos pendentes de recebimento em agendas que continuam abertas.",
  "Sem conferência": "Agendamentos que permaneceram aguardando quando a agenda foi concluída. Não significa que o caminhão não foi recebido.",
  "Recusados": "Agendamentos com status recusado no período filtrado.",
  "Evolução diária": "Volume diário por resultado: recebidos, não recebidos, aguardando em dias abertos, sem conferência em dias concluídos e recusados.",
  "Comparativo por loja": "Taxa de recebimento de cada loja: recebidos ÷ total da unidade × 100. A barra representa esse percentual.",
  "Fornecedores com ocorrências": "Fornecedores com mais não recebimentos. A barra compara a quantidade de cada um com a do líder do ranking.",
  "Por loja": "Indicadores consolidados por unidade, distinguindo aguardando em agendas abertas de sem conferência em agendas concluídas.",
  "Por data": "Resultados por dia e loja, incluindo a separação entre aguardando e sem conferência conforme a situação da agenda.",
  "Ocorrências e observações": "Lista dos não recebimentos com fornecedor, protocolo e motivo. Registros antigos podem não ter motivo."
});

export function reportInfo(title) {
  const description = REPORT_HELP[title];
  if (!description) return "";
  const id = "report-help-" + (Object.keys(REPORT_HELP).indexOf(title) + 1);
  return '<span class="report-info"><button type="button" class="report-info-button" data-report-info ' +
    'aria-label="Sobre: ' + escapeHtml(title) + '" aria-describedby="' + id + '" aria-controls="' + id + '" aria-expanded="false"><img class="report-info-icon" src="/vendor/lucide/info.svg" alt="" aria-hidden="true" width="15" height="15"></button>' +
    '<span class="report-info-tooltip" role="tooltip" id="' + id + '">' +
    escapeHtml(description) + '</span></span>';
}

function closeOpen(root) {
  for (const button of root.querySelectorAll('[data-report-info][aria-expanded="true"]')) {
    button.setAttribute("aria-expanded", "false");
    button.closest(".report-info")?.removeAttribute("data-open");
  }
}

export function setupReportInfo(root) {
  const onClick = event => {
    const button = event.target.closest?.("[data-report-info]");
    if (button && root.contains(button)) {
      const opening = button.getAttribute("aria-expanded") !== "true";
      closeOpen(root);
      button.setAttribute("aria-expanded", String(opening));
      button.closest(".report-info")?.toggleAttribute("data-open", opening);
      if (!opening) button.blur();
      return;
    }
    closeOpen(root);
  };
  const onOutsideClick = event => {
    if (!root.contains(event.target)) closeOpen(root);
  };
  const onKeydown = event => {
    if (event.key !== "Escape") return;
    const opened = root.querySelector('[data-report-info][aria-expanded="true"]');
    if (!opened) return;
    closeOpen(root);
    opened.blur();
  };
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKeydown);
  root.ownerDocument.addEventListener("click", onOutsideClick);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKeydown);
    root.ownerDocument.removeEventListener("click", onOutsideClick);
  };
}