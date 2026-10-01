import type { AuthUser } from "../../shared/auth";
import { businessDate } from "../../shared/time";
import type {
  AdminAgendaDetail,
  AdminAgendaSummary,
  AdminStore,
  AdminStorePresence,
  AdminUser,
} from "../admin/types";
import type {
  StoreAgenda,
  StoreAppointment,
  StoreAppointmentDetail,
} from "../agenda/types";

export const MOCK_DATE = businessDate();

export const MOCK_USERS_BY_ROLE: Record<
  "admin" | "conferente" | "visualizador",
  AuthUser
> = {
  admin: {
    id: "preview-admin",
    nome: "Mariana Costa",
    papel: "admin",
    lojaId: null,
    lojaCodigo: null,
    lojaNome: null,
  },
  conferente: {
    id: "preview-conferente",
    nome: "Gabriel Souza",
    papel: "conferente",
    lojaId: "store-cd-01",
    lojaCodigo: "CD Doca 01",
    lojaNome: "Centro de Distribuição - Doca 01",
  },
  visualizador: {
    id: "preview-visualizador",
    nome: "Carla Martins",
    papel: "visualizador",
    lojaId: null,
    lojaCodigo: null,
    lojaNome: null,
  },
};

export const MOCK_STORES: AdminStore[] = [
  { id: "store-f03", codigo: "F03", nome: "Filial 03 - Centro", ativo: true },
  { id: "store-f08", codigo: "F08", nome: "Filial 08 - Kobrasol", ativo: true },
  { id: "store-f12", codigo: "F12", nome: "Filial 12 - Continente", ativo: true },
  { id: "store-f18", codigo: "F18", nome: "Filial 18 - Biguaçu", ativo: true },
  { id: "store-f24", codigo: "F24", nome: "Filial 24 - Campinas", ativo: true },
  { id: "store-cd-01", codigo: "CD Doca 01", nome: "Centro de Distribuição - Doca 01", ativo: true },
  { id: "store-cd-02", codigo: "CD Doca 02", nome: "Centro de Distribuição - Doca 02", ativo: true },
];

export const MOCK_ADMIN_USERS: AdminUser[] = [
  {
    id: "preview-admin",
    nome: "Mariana Costa",
    login: "admin",
    papel: "admin",
    lojaId: null,
    ativo: true,
  },
  {
    id: "preview-conferente",
    nome: "Gabriel Souza",
    login: "conferente",
    papel: "conferente",
    lojaId: "store-cd-01",
    ativo: true,
  },
  {
    id: "preview-conferente-2",
    nome: "Lucas Ferreira",
    login: "conferente.f03",
    papel: "conferente",
    lojaId: "store-f03",
    ativo: true,
  },
  {
    id: "preview-visualizador",
    nome: "Carla Martins",
    login: "visualizador",
    papel: "visualizador",
    lojaId: null,
    ativo: true,
  },
];

export const MOCK_PRESENCES: AdminStorePresence[] = [
  { storeId: "store-f03", status: "online" },
  { storeId: "store-f08", status: "away" },
  { storeId: "store-f12", status: "offline" },
  { storeId: "store-f18", status: "online" },
  { storeId: "store-f24", status: "offline" },
  { storeId: "store-cd-01", status: "online" },
  { storeId: "store-cd-02", status: "away" },
];

export const MOCK_STORE_APPOINTMENTS: StoreAppointment[] = [
  {
    id: "apt-01",
    protocol: "PRV-2601001",
    startTime: "07:00",
    endTime: "07:30",
    supplier: "Distribuidora Vale do Itajaí Alimentos e Bebidas Ltda.",
    items: 18,
    volumes: 42,
    pallets: 2,
    cargaBatida: "Não",
    type: "Secos",
    nfe: ["35261000000000000123550010000010011000010010"],
    orders: ["4500123401", "4500123402"],
    status: "recebido",
    hasExchanges: false,
    origin: "imported",
    ativo: true,
  },
  {
    id: "apt-02",
    protocol: "PRV-2601002",
    startTime: "07:30",
    endTime: "08:00",
    supplier: "Cooperativa Regional de Laticínios Serra Azul",
    items: 11,
    volumes: 25,
    pallets: 1,
    cargaBatida: "Sim",
    type: "Refrigerado",
    nfe: ["35261000000000000223550010000010021000010020"],
    orders: ["4500123410"],
    status: "aguardando",
    hasExchanges: true,
    origin: "imported",
    ativo: true,
  },
  {
    id: "apt-03",
    protocol: "PRV-2601003",
    startTime: "08:00",
    endTime: "08:30",
    supplier: "Frutas Catarinenses Comércio e Distribuição",
    items: 9,
    volumes: 63,
    pallets: 3,
    cargaBatida: "Não",
    type: "Hortifruti",
    nfe: [],
    orders: ["4500123420"],
    status: "recebido",
    hasExchanges: false,
    origin: "imported",
    ativo: true,
  },
  {
    id: "apt-04",
    protocol: "PRV-2601004",
    startTime: "08:30",
    endTime: "09:00",
    supplier: "Indústria de Produtos de Limpeza Santa Catarina S.A.",
    items: 27,
    volumes: 88,
    pallets: 4,
    cargaBatida: "Sim",
    type: "Limpeza",
    nfe: [],
    orders: ["4500123430", "4500123431"],
    status: "nao_chegou",
    hasExchanges: false,
    origin: "imported",
    ativo: true,
  },
  {
    id: "apt-05",
    protocol: "PRV-2601005",
    startTime: "09:00",
    endTime: "09:30",
    supplier: "Panificação Imperial",
    items: 7,
    volumes: 16,
    pallets: 1,
    cargaBatida: "Não",
    type: "Padaria",
    nfe: [],
    orders: ["4500123440"],
    status: "aguardando",
    hasExchanges: false,
    origin: "imported",
    ativo: true,
  },
  {
    id: "apt-06",
    protocol: "PRV-2601006",
    startTime: "09:30",
    endTime: "10:00",
    supplier: "Bebidas do Sul Distribuidora",
    items: 14,
    volumes: 96,
    pallets: 5,
    cargaBatida: "Sim",
    type: "Bebidas",
    nfe: [],
    orders: ["4500123450"],
    status: "recebido",
    hasExchanges: true,
    origin: "imported",
    ativo: true,
  },
  {
    id: "apt-07",
    protocol: "SEM-AGENDA-01",
    startTime: "10:15",
    endTime: "10:15",
    supplier: "Fornecedor avulso - exemplo",
    items: null,
    volumes: null,
    pallets: null,
    cargaBatida: null,
    type: "Sem agenda",
    nfe: [],
    orders: [],
    status: "aguardando",
    hasExchanges: false,
    origin: "manual",
    ativo: true,
  },
  {
    id: "apt-08",
    protocol: "PRV-2601008",
    startTime: "10:30",
    endTime: "11:00",
    supplier: "Congelados Atlântico",
    items: 12,
    volumes: 34,
    pallets: 2,
    cargaBatida: "Não",
    type: "Congelado",
    nfe: [],
    orders: ["4500123460"],
    status: "recusado",
    hasExchanges: false,
    origin: "imported",
    ativo: true,
  },
];

function summary(
  store: AdminStore,
  values: Pick<
    AdminAgendaSummary,
    "total" | "aguardando" | "recebido" | "naoChegou" | "recusado" | "semAgenda" | "dayStatus"
  >,
): AdminAgendaSummary {
  return {
    id: `agenda-${store.id}`,
    storeId: store.id,
    storeCode: store.codigo,
    storeName: store.nome,
    date: MOCK_DATE,
    originalFileName: "agenda-preview.csv",
    completedAt:
      values.dayStatus === "concluido" ? `${MOCK_DATE}T15:42:00-03:00` : null,
    completedBy:
      values.dayStatus === "concluido"
        ? { id: "preview-conferente", name: "Gabriel Souza" }
        : null,
    ...values,
  };
}

export const MOCK_AGENDAS: AdminAgendaSummary[] = [
  summary(MOCK_STORES[0], { total: 18, aguardando: 2, recebido: 15, naoChegou: 1, recusado: 0, semAgenda: 0, dayStatus: "aberto" }),
  summary(MOCK_STORES[1], { total: 21, aguardando: 0, recebido: 20, naoChegou: 1, recusado: 0, semAgenda: 0, dayStatus: "concluido" }),
  summary(MOCK_STORES[2], { total: 16, aguardando: 5, recebido: 9, naoChegou: 1, recusado: 1, semAgenda: 0, dayStatus: "aberto" }),
  summary(MOCK_STORES[3], { total: 23, aguardando: 0, recebido: 23, naoChegou: 0, recusado: 0, semAgenda: 0, dayStatus: "concluido" }),
  summary(MOCK_STORES[5], { total: 8, aguardando: 3, recebido: 3, naoChegou: 1, recusado: 1, semAgenda: 1, dayStatus: "aberto" }),
  summary(MOCK_STORES[6], { total: 12, aguardando: 1, recebido: 10, naoChegou: 1, recusado: 0, semAgenda: 0, dayStatus: "aberto" }),
];

export function mockAdminAgendaDetail(agendaId: string): AdminAgendaDetail {
  const source =
    MOCK_AGENDAS.find((agenda) => agenda.id === agendaId) ?? MOCK_AGENDAS[4];

  return {
    agenda: {
      id: source.id,
      storeCode: source.storeCode,
      storeName: source.storeName,
      date: source.date,
      originalFileName: source.originalFileName,
      dayStatus: source.dayStatus,
      completedAt: source.completedAt,
      completedBy: source.completedBy,
    },
    appointments: MOCK_STORE_APPOINTMENTS.map((appointment) => ({
      ...appointment,
      items: appointment.items,
      volumes: appointment.volumes,
      pallets: appointment.pallets,
      cargaBatida: appointment.cargaBatida,
      type: appointment.type,
      nfe: [...appointment.nfe],
      orders: [...appointment.orders],
    })),
  };
}

export function mockStoreAgenda(date = MOCK_DATE): StoreAgenda {
  return {
    agenda: {
      id: "agenda-store-cd-01",
      storeId: "store-cd-01",
      storeCode: "CD Doca 01",
      storeName: "Centro de Distribuição - Doca 01",
      date,
      originalFileName: "agenda-preview.csv",
      dayStatus: "aberto",
      completedAt: null,
      completedBy: null,
    },
    appointments: MOCK_STORE_APPOINTMENTS.map((appointment) => ({
      ...appointment,
      nfe: [...appointment.nfe],
      orders: [...appointment.orders],
    })),
  };
}

export function mockAppointmentDetail(id: string): StoreAppointmentDetail {
  const appointment =
    MOCK_STORE_APPOINTMENTS.find((item) => item.id === id) ??
    MOCK_STORE_APPOINTMENTS[0];

  return {
    ...appointment,
    nfe: [...appointment.nfe],
    orders: [...appointment.orders],
    history:
      appointment.status === "aguardando"
        ? []
        : [
            {
              id: `history-${appointment.id}`,
              statusAnterior: "aguardando",
              statusNovo: appointment.status,
              alteradoEm: `${MOCK_DATE}T10:12:00-03:00`,
              usuario: {
                id: "preview-conferente",
                nome: "Gabriel Souza",
              },
            },
          ],
  };
}
