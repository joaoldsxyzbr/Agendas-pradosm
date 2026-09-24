import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { STATUS_LABELS } from "./StatusControl";
import type { StoreAppointmentDetail } from "./types";

function valueOrDash(value: string | number | null | undefined) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export function AgendaDetails({
  appointmentId,
  onClose,
}: {
  appointmentId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<StoreAppointmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointmentId) {
      setDetail(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void apiFetch<StoreAppointmentDetail>(
      `/api/store/appointments/${appointmentId}`,
    )
      .then((data) => {
        if (active) setDetail(data);
      })
      .catch(() => {
        if (active) setError("Não foi possível carregar os detalhes.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appointmentId]);

  if (!appointmentId) return null;

  return (
    <section className="agenda-details" aria-labelledby="agenda-details-title">
      <div className="section-heading agenda-details-heading">
        <div>
          <span className="eyebrow">Recebimento</span>
          <h2 id="agenda-details-title">Detalhes do agendamento</h2>
        </div>
        <button className="ghost-button" type="button" onClick={onClose}>
          Fechar
        </button>
      </div>

      {loading ? <p className="muted-state">Carregando detalhes...</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {detail ? (
        <>
          <dl className="detail-grid">
            <div><dt>Horário</dt><dd>{detail.startTime} - {detail.endTime}</dd></div>
            <div><dt>Protocolo</dt><dd>{detail.protocol}</dd></div>
            <div><dt>Fornecedor</dt><dd>{detail.supplier}</dd></div>
            <div><dt>Status</dt><dd>{STATUS_LABELS[detail.status]}</dd></div>
            <div><dt>Tipo</dt><dd>{valueOrDash(detail.type)}</dd></div>
            <div><dt>Itens</dt><dd>{valueOrDash(detail.items)}</dd></div>
            <div><dt>Volumes</dt><dd>{valueOrDash(detail.volumes)}</dd></div>
            <div><dt>Paletes</dt><dd>{valueOrDash(detail.pallets)}</dd></div>
            <div><dt>Carga batida</dt><dd>{valueOrDash(detail.cargaBatida)}</dd></div>
          </dl>

          <div className="document-grid">
            <section>
              <h3>NF-e</h3>
              {detail.nfe.length ? (
                <ul>
                  {detail.nfe.map((nfe) => <li key={nfe}>{nfe}</li>)}
                </ul>
              ) : (
                <p>Nenhuma NF-e informada.</p>
              )}
            </section>

            <section>
              <h3>Pedidos</h3>
              {detail.orders.length ? (
                <ul>
                  {detail.orders.map((order) => <li key={order}>{order}</li>)}
                </ul>
              ) : (
                <p>Nenhum pedido informado.</p>
              )}
            </section>
          </div>

          <section className="history-box">
            <h3>Histórico de alterações</h3>
            {detail.history.length ? (
              <ul>
                {detail.history.map((item) => (
                  <li key={item.id}>
                    <strong>{item.statusAnterior} → {item.statusNovo}</strong>
                    <span>{item.usuario.nome}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nenhuma alteração de status registrada.</p>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}
