import { renderDashboard } from "./dashboard.js";
import { renderReports } from "./reports.js";
import { renderStores } from "./stores.js";
import { renderUsers } from "./users.js";
import { renderHistory } from "./history.js";
import { renderToday } from "./today.js";
import { renderImportAgenda } from "./import-agenda.js";
import { renderDiagnostics } from "./diagnostics.js";
import { renderCrossAdmin } from "./cross.js";
import { openAdminAgendaPreview } from "./admin-agenda-preview.js";

// Registro das páginas da aplicação atual em JavaScript nativo, sem React/TSX.
export function createMigratedPageRenderers({ realtime } = {}) {
  return {
    dashboard(ctx) {
      let closeModal = () => {};
      const dismiss = () => {
        const previous = closeModal;
        closeModal = () => {};
        previous();
      };
      const mountModal = factory => {
        dismiss();
        const host = ctx.root.ownerDocument.createElement("div");
        ctx.root.appendChild(host);
        let unmount = () => {};
        closeModal = () => { unmount(); host.remove(); };
        unmount = factory(host, () => dismiss()) || (() => {});
      };
      const detach = renderDashboard(ctx.root, {
        request: ctx.request, readOnly: ctx.readOnly, realtime,
        openImport: onImported => {
          if (ctx.readOnly) return;
          mountModal((host, close) => renderImportAgenda(host, {
            modal: true, request: ctx.request, onClose: close, onImported
          }));
        },
        openAgenda: (id, options) => {
          mountModal((host, close) => openAdminAgendaPreview(host, {
            agendaId: id, request: ctx.request, realtime,
            canEdit: !ctx.readOnly, canReopen: !ctx.readOnly,
            onAgendaChanged: options.onAgendaChanged,
            onClose: close
          }));
        }
      });
      return () => { dismiss(); detach(); };
    },
    reports(ctx) { return renderReports(ctx.root, {request:ctx.request}); },
    diagnostics(ctx) { return renderDiagnostics(ctx.root, {request:ctx.request}); },
    cross(ctx) { return renderCrossAdmin(ctx.root, { request: ctx.request }); },
    stores(ctx) { return renderStores(ctx.root, { request: ctx.request }); },
    users(ctx) { return renderUsers(ctx.root, { request: ctx.request }); },
    history(ctx) { return renderHistory(ctx.root, { request: ctx.request }); },
    import(ctx) {
      // A rota /admin/import existia na main, além do popup no Dashboard.
      return renderImportAgenda(ctx.root, { request: ctx.request });
    },
    today(ctx) {
      return renderToday(ctx.root, {
        request: ctx.request, realtime, commandSlot: ctx.commandSlot,
        canSeeCross: ctx.user?.papel === "conferente" && ctx.user?.lojaCodigo?.toUpperCase() === "CD DOCA 01"
      });
    }
  };
}