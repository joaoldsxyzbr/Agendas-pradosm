import { useState, type ChangeEvent } from "react";
import type { ParseAgendaResult } from "../../shared/agenda";
import { extractPdfText } from "../import/extractPdfText";
import { parseAgendaText } from "../import/parseAgendaText";
import { ApiError, apiFetch } from "../lib/api";

function formatDate(value: string | null) {
  if (!value) return "Data não identificada";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function countLabel(total: number) {
  return total === 1 ? "1 agendamento" : `${total} agendamentos`;
}

function errorLabel(error: string) {
  const [code] = error.split(":");
  const labels: Record<string, string> = {
    FILIAL_NAO_IDENTIFICADA: "Filial não identificada no PDF.",
    DATA_NAO_IDENTIFICADA: "Data não identificada no PDF.",
    SEM_AGENDAMENTOS_VALIDOS: "Nenhum agendamento válido foi encontrado.",
    REGISTROS_NAO_INTERPRETADOS: "Há registros que não puderam ser interpretados.",
    TOTAL_DIVERGENTE: "O total informado no PDF diverge dos registros encontrados.",
    PROTOCOLO_DUPLICADO: "Há protocolo duplicado na agenda.",
  };
  return labels[code] ? `${labels[code]} (${error})` : error;
}

export function ImportAgendaPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParseAgendaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replacePending, setReplacePending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setPreview(null);
    setMessage(null);
    setSuccess(false);
    setReplacePending(false);

    if (!selected) return;

    if (
      selected.type !== "application/pdf" &&
      !selected.name.toLowerCase().endsWith(".pdf")
    ) {
      setMessage("Selecione um arquivo PDF.");
      return;
    }

    setLoading(true);
    try {
      const text = await extractPdfText(selected);
      setPreview(parseAgendaText(text));
    } catch {
      setMessage("Não foi possível ler o PDF selecionado.");
    } finally {
      setLoading(false);
    }
  }

  function importBody(replace = false) {
    if (!file || !preview?.storeCode || !preview.date) return null;

    return {
      storeCode: preview.storeCode,
      date: preview.date,
      originalFileName: file.name,
      appointments: preview.appointments.map(({ status: _status, ...appointment }) => appointment),
      ...(replace ? { replace: true } : {}),
    };
  }

  async function submit(replace = false) {
    const body = importBody(replace);
    if (!body || !preview || preview.blockingErrors.length > 0) return;

    setSubmitting(true);
    setMessage(null);
    setSuccess(false);

    try {
      await apiFetch("/api/admin/agendas/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setReplacePending(false);
      setSuccess(true);
      setMessage(replace ? "Agenda substituída com sucesso." : "Agenda importada com sucesso.");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setReplacePending(true);
        setMessage("Já existe uma agenda para esta loja e data.");
      } else {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "Não foi possível importar a agenda.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  const blocked = Boolean(preview?.blockingErrors.length);
  const canConfirm = Boolean(
    file &&
      preview &&
      preview.storeCode &&
      preview.date &&
      preview.appointments.length > 0 &&
      !blocked &&
      !submitting,
  );

  return (
    <section className="admin-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">Agenda diária</span>
          <h1>Importar agenda</h1>
          <p>Selecione o PDF, confira a prévia e só então confirme a importação.</p>
        </div>
      </header>

      <div className="upload-card">
        <label className="file-field">
          <span>Arquivo PDF</span>
          <input type="file" accept=".pdf,application/pdf" onChange={selectFile} />
        </label>
        <p className="field-help">
          O arquivo é interpretado no navegador antes da confirmação.
        </p>
      </div>

      {loading ? <p className="muted-state">Lendo PDF...</p> : null}

      {message ? (
        <p className={success ? "success-message" : "feedback-message"}>
          {message}
        </p>
      ) : null}

      {preview ? (
        <div className="preview-stack">
          <section className="preview-summary">
            <div>
              <span>Loja</span>
              <strong>
                {preview.storeCode
                  ? `${preview.storeCode} - ${preview.storeName ?? "Nome não identificado"}`
                  : "Não identificada"}
              </strong>
            </div>
            <div>
              <span>Data</span>
              <strong>{formatDate(preview.date)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{countLabel(preview.appointments.length)}</strong>
            </div>
          </section>

          {preview.blockingErrors.length > 0 ? (
            <section className="validation-panel error-panel" aria-label="Erros da importação">
              <h2>Corrija antes de importar</h2>
              <ul>
                {preview.blockingErrors.map((error) => (
                  <li key={error}>{errorLabel(error)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {preview.warnings.length > 0 ? (
            <section className="validation-panel warning-panel" aria-label="Avisos da importação">
              <h2>Avisos</h2>
              <ul>
                {preview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="table-card">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Horário</th>
                    <th>Protocolo</th>
                    <th>Fornecedor</th>
                    <th>Itens</th>
                    <th>Volumes</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.appointments.map((appointment) => (
                    <tr key={appointment.protocol}>
                      <td>{appointment.startTime} - {appointment.endTime}</td>
                      <td>{appointment.protocol}</td>
                      <td>{appointment.supplier}</td>
                      <td>{appointment.items ?? "-"}</td>
                      <td>{appointment.volumes ?? "-"}</td>
                      <td>{appointment.type}</td>
                    </tr>
                  ))}
                  {preview.appointments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-cell">
                        Nenhum agendamento interpretado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="action-row">
            <button
              className="primary-button"
              type="button"
              disabled={!canConfirm}
              onClick={() => void submit(false)}
            >
              {submitting ? "Importando..." : "Confirmar importação"}
            </button>
          </div>

          {replacePending ? (
            <section className="replace-panel" role="alert">
              <div>
                <strong>Agenda já existente</strong>
                <p>
                  Substituir atualiza os dados do PDF, preservando os status já
                  registrados para protocolos existentes.
                </p>
              </div>
              <button
                className="danger-button"
                type="button"
                disabled={submitting}
                onClick={() => void submit(true)}
              >
                Substituir agenda
              </button>
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
