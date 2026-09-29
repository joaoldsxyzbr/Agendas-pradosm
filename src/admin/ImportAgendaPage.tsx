import { useState, type ChangeEvent } from "react";
import { extractPdfText } from "../import/extractPdfText";
import {
  parseAgendaCsv,
  parseAgendaPdfText,
  type ParseAgendaBatchResult,
} from "../import/parseAgendaBatch";
import { ApiError, apiFetch } from "../lib/api";

function formatDate(value: string | null) {
  if (!value) return "Data não identificada";
  const [year, month, day] = value.split("-");
  return day && month && year ? `${day}/${month}/${year}` : value;
}

function countLabel(total: number) {
  return total === 1 ? "1 agendamento" : `${total} agendamentos`;
}

function storeCountLabel(total: number) {
  return total === 1 ? "1 loja" : `${total} lojas`;
}

function errorLabel(error: string) {
  const [code] = error.split(":");
  const labels: Record<string, string> = {
    FILIAL_NAO_IDENTIFICADA: "Filial não identificada no arquivo.",
    DATA_NAO_IDENTIFICADA: "Data não identificada no arquivo.",
    SEM_AGENDAMENTOS_VALIDOS: "Nenhum agendamento válido foi encontrado.",
    REGISTROS_NAO_INTERPRETADOS:
      "Há registros que não puderam ser interpretados com segurança.",
    TOTAL_DIVERGENTE:
      "O total informado no arquivo diverge dos registros encontrados.",
    PROTOCOLO_DUPLICADO: "Há protocolo duplicado na agenda.",
    DATAS_DIVERGENTES: "O arquivo contém mais de uma data de agenda.",
    DATA_DIVERGENTE:
      "A data dos registros diverge da data informada no filtro do arquivo.",
    FORMATO_CSV_NAO_RECONHECIDO:
      "O CSV não possui as colunas esperadas da agenda de recebimento.",
  };
  return labels[code] ? `${labels[code]} (${error})` : error;
}

function isPdf(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function isCsv(file: File) {
  return (
    file.type === "text/csv" ||
    file.type === "application/csv" ||
    file.name.toLowerCase().endsWith(".csv")
  );
}

type ImportAgendaPageProps = {
  modal?: boolean;
  onClose?: () => void;
  onImported?: () => void;
};

type BatchImportResponse = {
  totalAgendas: number;
  totalAppointments: number;
  created: number;
  replaced: number;
};

export function ImportAgendaPage({
  modal = false,
  onClose,
  onImported,
}: ImportAgendaPageProps = {}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParseAgendaBatchResult | null>(null);
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

    if (!isCsv(selected) && !isPdf(selected)) {
      setMessage("Selecione um arquivo CSV ou PDF.");
      return;
    }

    setLoading(true);
    try {
      if (isCsv(selected)) {
        setPreview(parseAgendaCsv(await selected.text()));
      } else {
        const text = await extractPdfText(selected);
        setPreview(parseAgendaPdfText(text));
      }
    } catch {
      setMessage(
        isCsv(selected)
          ? "Não foi possível ler o CSV selecionado."
          : "Não foi possível ler o PDF selecionado.",
      );
    } finally {
      setLoading(false);
    }
  }

  function importBody(replace = false) {
    if (!file || !preview) return null;

    const agendas = preview.agendas.flatMap((agenda) => {
      if (!agenda.storeCode || !agenda.date) return [];

      return [
        {
          storeCode: agenda.storeCode,
          date: agenda.date,
          originalFileName: file.name,
          appointments: agenda.appointments.map(
            ({ status: _status, ...appointment }) => appointment,
          ),
          ...(replace ? { replace: true } : {}),
        },
      ];
    });

    if (agendas.length !== preview.agendas.length || agendas.length === 0) {
      return null;
    }

    return { agendas };
  }

  async function submit(replace = false) {
    const body = importBody(replace);
    if (!body || !preview || preview.blockingErrors.length > 0) return;

    setSubmitting(true);
    setMessage(null);
    setSuccess(false);

    try {
      const result = await apiFetch<BatchImportResponse>(
        "/api/admin/agendas/import/bulk",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      setReplacePending(false);
      setSuccess(true);
      setMessage(
        `Importação concluída: ${storeCountLabel(result.totalAgendas)} e ${countLabel(result.totalAppointments)}.`,
      );
      onImported?.();
      if (modal) onClose?.();
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setReplacePending(true);
        setMessage("Já existe agenda para uma ou mais lojas e datas deste arquivo.");
      } else {
        setMessage(
          error instanceof ApiError
            ? error.message
            : "Não foi possível importar as agendas.",
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
      preview.agendas.length > 0 &&
      preview.totalAppointments > 0 &&
      preview.agendas.every((agenda) => agenda.storeCode && agenda.date) &&
      !blocked &&
      !submitting,
  );

  const previewRows =
    preview?.agendas.flatMap((agenda) =>
      agenda.appointments.map((appointment) => ({
        storeCode: agenda.storeCode ?? "—",
        appointment,
      })),
    ) ?? [];

  const content = (
    <div className="admin-page import-agenda-content">
      <header className={modal ? "modal-heading" : "page-heading"}>
        <div>
          <span className="eyebrow">Agenda diária</span>
          {modal ? (
            <h2 id="import-agenda-title">Importar agenda</h2>
          ) : (
            <h1 id="import-agenda-title">Importar agenda</h1>
          )}
          <p>
            Importe o CSV com todas as lojas de uma vez. O PDF continua
            disponível como formato de reserva.
          </p>
        </div>
        {modal ? (
          <button className="ghost-button" type="button" onClick={onClose}>
            Fechar
          </button>
        ) : null}
      </header>

      <div className="upload-card">
        <label className="file-field">
          <span>Arquivo CSV ou PDF</span>
          <input
            type="file"
            accept=".csv,text/csv,.pdf,application/pdf"
            onChange={selectFile}
          />
        </label>
        <p className="field-help">
          O arquivo é interpretado no navegador. Nenhuma agenda é gravada até
          você conferir a prévia e confirmar.
        </p>
      </div>

      {loading ? <p className="muted-state">Lendo arquivo...</p> : null}

      {message ? (
        <p className={success ? "success-message" : "feedback-message"}>
          {message}
        </p>
      ) : null}

      {preview ? (
        <div className="preview-stack">
          <section className="preview-summary">
            <div>
              <span>Lojas</span>
              <strong>{storeCountLabel(preview.agendas.length)}</strong>
            </div>
            <div>
              <span>Data</span>
              <strong>{formatDate(preview.date)}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{countLabel(preview.totalAppointments)}</strong>
            </div>
          </section>

          {preview.blockingErrors.length > 0 ? (
            <section
              className="validation-panel error-panel"
              aria-label="Erros da importação"
            >
              <h2>Corrija antes de importar</h2>
              <ul>
                {preview.blockingErrors.map((error) => (
                  <li key={error}>{errorLabel(error)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {preview.warnings.length > 0 ? (
            <section
              className="validation-panel warning-panel"
              aria-label="Avisos da importação"
            >
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
                    <th>Loja</th>
                    <th>Horário</th>
                    <th>Protocolo</th>
                    <th>Fornecedor</th>
                    <th>Itens</th>
                    <th>Volumes</th>
                    <th>Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(({ storeCode, appointment }) => (
                    <tr key={`${storeCode}:${appointment.protocol}`}>
                      <td>{storeCode}</td>
                      <td>
                        {appointment.startTime} - {appointment.endTime}
                      </td>
                      <td>{appointment.protocol}</td>
                      <td>{appointment.supplier}</td>
                      <td>{appointment.items ?? "-"}</td>
                      <td>{appointment.volumes ?? "-"}</td>
                      <td>{appointment.type}</td>
                    </tr>
                  ))}
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-cell">
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
                <strong>Há agendas já existentes</strong>
                <p>
                  A substituição atualiza somente os dados importados e preserva
                  status, histórico e fornecedores adicionados manualmente.
                </p>
              </div>
              <button
                className="danger-button"
                type="button"
                disabled={submitting}
                onClick={() => void submit(true)}
              >
                Substituir agendas existentes
              </button>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (!modal) return <section className="admin-page">{content}</section>;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className="modal-card import-agenda-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-agenda-title"
      >
        {content}
      </section>
    </div>
  );
}
