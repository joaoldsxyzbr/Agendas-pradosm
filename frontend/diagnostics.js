import { apiFetch } from "./api.js";
import { escapeHtml } from "./shell.js";

const LABELS = {
  IMPORT_SELECTED: "Arquivo selecionado",
  IMPORT_PREVIEW_READY: "Prévia da importação pronta",
  IMPORT_VALIDATION_FAILED: "Arquivo não passou na validação",
  IMPORT_READ_FAILED: "Falha na leitura do arquivo",
  IMPORT_REQUEST_FAILED: "Falha no envio da importação",
  IMPORT_SUCCEEDED: "Importação confirmada",
  IMPORT_DROP_REJECTED: "Arquivo arrastado recusado",
  BROWSER_EXCEPTION: "Erro do JavaScript",
  BROWSER_REJECTION: "Falha assíncrona no navegador",
  WORKER_EXCEPTION: "Erro inesperado no Worker"
};
const text = value => escapeHtml(value ?? "—");
const dateBR = value => {
  try { return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short"
  }).format(new Date(value)); } catch { return "—"; }
};

export function renderDiagnostics(root, {request = apiFetch} = {}) {
  let disposed = false, tab = "errors", records = [], loading = false, issue = "";
  let generation = 0;
  root.innerHTML = `<section class="admin-page diagnostic-page">
    <header class="page-heading page-heading-actions">
      <div><span class="eyebrow">Administração</span><h1>Logs e Auditoria</h1>
        <p>Diagnostique falhas técnicas e consulte alterações realizadas no sistema.</p></div>
      <button type="button" class="ghost-button" data-diagnostics-refresh>Atualizar</button>
    </header>
    <div class="diagnostic-tabs" role="tablist" aria-label="Categoria de registros">
      <button type="button" data-diagnostics-tab="errors" class="ghost-button" role="tab" aria-selected="true">Erros</button>
      <button type="button" data-diagnostics-tab="operations" class="ghost-button" role="tab" aria-selected="false">Operações</button>
      <button type="button" data-diagnostics-tab="audit" class="ghost-button" role="tab" aria-selected="false">Auditoria</button>
    </div>
    <form class="diagnostic-filters" data-diagnostics-form>
      <label>Data (UTC)<input type="date" name="date"></label>
      <label>Origem<select name="origem"><option value="">Todas</option><option value="browser">Navegador</option><option value="worker">Worker</option></select></label>
      <label>Área<select name="operacao"><option value="">Todas</option><option value="importacao">Importação</option><option value="aplicativo">Aplicativo</option><option value="api">API</option></select></label>
      <label>Usuário<select name="userId"><option value="">Todos</option></select></label>
      <label>Loja<select name="storeId"><option value="">Todas</option></select></label>
      <button type="submit" class="primary-button">Filtrar</button>
    </form>
    <p class="muted-state" data-diagnostics-summary></p>
    <p class="form-error" role="alert" data-diagnostics-error hidden></p>
    <div data-diagnostics-results></div>
  </section>`;
  const errorEl = root.querySelector("[data-diagnostics-error]");
  const results = root.querySelector("[data-diagnostics-results]");
  const summary = root.querySelector("[data-diagnostics-summary]");
  const form = root.querySelector("[data-diagnostics-form]");
  const loadChoices = async () => {
    try {
      const [users,stores] = await Promise.all([
        request("/api/admin/users"), request("/api/admin/stores")
      ]);
      if (disposed) return;
      form.elements.userId.innerHTML = '<option value="">Todos</option>' + users.map(u =>
        `<option value="${text(u.id)}">${text(u.nome)}</option>`).join("");
      form.elements.storeId.innerHTML = '<option value="">Todas</option>' + stores.map(s =>
        `<option value="${text(s.id)}">${text(s.codigo)} · ${text(s.nome)}</option>`).join("");
    } catch { /* Falha de filtros adicionais não impede a consulta de registros. */ }
  };
  const draw = () => {
    if (disposed) return;
    root.querySelectorAll("[data-diagnostics-tab]").forEach(button => {
      const active = button.dataset.diagnosticsTab === tab;
      button.setAttribute("aria-selected", String(active));
      button.classList.toggle("is-active", active);
    });
    for (const field of ["origem", "operacao"]) {
      form.elements[field].disabled = tab === "audit";
    }
    errorEl.hidden = !issue;
    errorEl.textContent = issue;
    if (loading) { results.textContent = "Carregando registros..."; return; }
    if (!records.length) {
      results.innerHTML = '<p class="muted-state">Nenhum registro encontrado para esta consulta.</p>';
      return;
    }
    const rows = records.map(item => {
      if (tab === "audit") {
        return `<tr><td>${text(dateBR(item.createdAt))}</td><td><strong>${text(item.action)}</strong>
          <small>${text(item.entity)}</small></td><td>${text(item.user?.name ?? "Sistema")}</td>
          <td>${text(item.details)}</td></tr>`;
      }
      const details = [item.format?.toUpperCase(), item.count == null ? null : item.count + " registros",
        item.durationMs == null ? null : item.durationMs + " ms",
        item.httpStatus == null ? null : "HTTP " + item.httpStatus].filter(Boolean).join(" · ");
      return `<tr><td>${text(dateBR(item.createdAt))}</td>
        <td><strong>${text(LABELS[item.event] ?? item.event)}</strong><small>${text(item.operation)} · ${text(item.source)}</small></td>
        <td><span class="diagnostic-level level-${text(item.level)}">${text(item.level)}</span></td>
        <td>${text(details)}<small title="${text(item.correlationId)}">ID: ${text(item.correlationId?.slice(0,8))}</small></td>
        <td>${text(item.user?.name ?? "Sistema")}</td></tr>`;
    }).join("");
    const heading = tab === "audit" ?
      "<tr><th>Data</th><th>Alteração</th><th>Responsável</th><th>Detalhes</th></tr>" :
      "<tr><th>Data</th><th>Evento</th><th>Nível</th><th>Informações</th><th>Responsável</th></tr>";
    results.innerHTML = `<div class="table-card"><div class="table-scroll"><table>
      <thead>${heading}</thead><tbody>${rows}</tbody></table></div></div>`;
  };
  const load = async () => {
    const seq = ++generation;
    loading = true; issue = ""; draw();
    try {
      const params = new URLSearchParams({limit:"100"});
      if (tab === "errors") params.set("nivel", "error");
      const filters = tab === "audit" ? ["date","userId","storeId"] :
        ["date","origem","operacao","userId","storeId"];
      for (const k of filters) {
        const value = form.elements[k].value;
        if (value) params.set(k, value);
      }
      const url = tab === "audit" ? "/api/admin/audit?" + params.toString() :
        "/api/admin/diagnostics?" + params.toString();
      const response = await request(url);
      if (disposed || seq !== generation) return;
      records = tab === "operations" ? response.filter(item => item.level !== "error") : response;
      summary.textContent = records.length + " registros nesta consulta (máximo de 100).";
    } catch {
      if (disposed || seq !== generation) return;
      records = [];
      summary.textContent = "";
      issue = "Não foi possível carregar os registros de auditoria. Tente novamente.";
    } finally {
      if (!disposed && seq === generation) { loading = false; draw(); }
    }
  };
  const onClick = event => {
    const tabButton = event.target.closest?.("[data-diagnostics-tab]");
    if (tabButton && root.contains(tabButton)) {
      tab = tabButton.dataset.diagnosticsTab;
      void load();
    } else if (event.target.closest?.("[data-diagnostics-refresh]")) {
      void load();
    }
  };
  const onSubmit = event => { event.preventDefault(); void load(); };
  root.addEventListener("click", onClick);
  form.addEventListener("submit", onSubmit);
  void loadChoices();
  void load();
  return () => {
    disposed = true; ++generation;
    root.removeEventListener("click", onClick);
    form.removeEventListener("submit", onSubmit);
  };
}