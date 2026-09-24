export const AGENDA_STATUSES = [
  "aguardando",
  "recebido",
  "nao_chegou",
  "recusado",
] as const;

export type AgendaStatus = (typeof AGENDA_STATUSES)[number];

export const AGENDA_DOCUMENT_TYPES = [
  "Nota fiscal",
  "Pedido",
  "CNPJ",
  "Agenda fixa",
] as const;

export type AgendaDocumentType = (typeof AGENDA_DOCUMENT_TYPES)[number];

export type ParsedAgendaAppointment = {
  protocol: string;
  startTime: string;
  endTime: string;
  supplier: string;
  items: number | null;
  volumes: number | null;
  pallets: number | null;
  cargaBatida: string | null;
  type: AgendaDocumentType;
  nfe: string[];
  orders: string[];
  status: "aguardando";
};

export type ParseAgendaResult = {
  storeCode: string | null;
  storeName: string | null;
  date: string | null;
  appointments: ParsedAgendaAppointment[];
  warnings: string[];
  blockingErrors: string[];
};
