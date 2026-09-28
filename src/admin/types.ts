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
  semAgenda: number;
  dayStatus: "aberto" | "concluido";
  completedAt: string | null;
  completedBy: { id: string; name: string | null } | null;
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
  hasExchanges: boolean;
  origin?: "imported" | "manual";
  ativo: boolean;
};

export type AdminAgendaDetail = {
  agenda: {
    id: string;
    storeCode: string;
    storeName: string;
    date: string;
    originalFileName?: string;
    dayStatus: "aberto" | "concluido";
    completedAt: string | null;
    completedBy: { id: string; name: string | null } | null;
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


export type AgendaDayHistoryItem = {
  id: string;
  action: "concluido" | "reaberto" | "ajuste_admin";
  details: string | null;
  changedAt: string;
  user: {
    id: string;
    name: string;
  };
};


export type AdminAuditItem = {
  id: string;
  action: string;
  entity: "agenda" | "agendamento" | "loja" | "usuario";
  entityId: string;
  storeId: string | null;
  agendaId: string | null;
  appointmentId: string | null;
  before: unknown;
  after: unknown;
  details: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
  } | null;
};
