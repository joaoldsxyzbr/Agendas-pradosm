export type AppointmentStatus =
  | "aguardando"
  | "recebido"
  | "nao_chegou"
  | "recusado";

export type StoreAppointment = {
  id: string;
  protocol: string;
  startTime: string;
  endTime: string;
  supplier: string;
  items: number | null;
  volumes: number | null;
  pallets: number | null;
  cargaBatida: string | null;
  type: string | null;
  nfe: string[];
  orders: string[];
  status: AppointmentStatus;
  ativo: boolean;
};

export type StoreAgenda = {
  agenda: {
    id: string;
    storeId?: string;
    storeCode: string;
    storeName: string;
    date: string;
    originalFileName?: string;
  } | null;
  appointments: StoreAppointment[];
};

export type StoreAgendaSummary = {
  id: string;
  storeCode: string;
  storeName: string;
  date: string;
  total: number;
  aguardando: number;
  recebido: number;
  naoChegou: number;
  recusado: number;
};

export type AppointmentHistoryItem = {
  id: string;
  statusAnterior: AppointmentStatus;
  statusNovo: AppointmentStatus;
  alteradoEm: string;
  usuario: {
    id: string;
    nome: string;
  };
};

export type StoreAppointmentDetail = StoreAppointment & {
  history: AppointmentHistoryItem[];
};
