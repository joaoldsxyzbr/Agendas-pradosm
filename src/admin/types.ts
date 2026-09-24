export type AdminStore = {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
};

export type AdminUser = {
  id: string;
  nome: string;
  login: string;
  perfil: "loja";
  lojaId: string;
  ativo: boolean;
};

export type AdminAgendaSummary = {
  id: string;
  storeId?: string;
  storeCode: string;
  storeName: string;
  date: string;
  originalFileName?: string;
  total: number;
  aguardando: number;
  recebido: number;
  naoChegou: number;
  recusado: number;
};

export type AdminAppointment = {
  id: string;
  protocol: string;
  startTime: string;
  endTime: string;
  supplier: string;
  items?: number | null;
  volumes?: number | null;
  pallets?: number | null;
  cargaBatida?: string | null;
  type?: string | null;
  nfe: string[];
  orders: string[];
  status: "aguardando" | "recebido" | "nao_chegou" | "recusado";
  ativo: boolean;
};

export type AdminAgendaDetail = {
  agenda: {
    id: string;
    storeCode: string;
    storeName: string;
    date: string;
    originalFileName?: string;
  };
  appointments: AdminAppointment[];
};

export type AppointmentHistoryItem = {
  id: string;
  statusAnterior: string;
  statusNovo: string;
  alteradoEm: string;
  usuario: {
    id: string;
    nome: string;
  };
};
