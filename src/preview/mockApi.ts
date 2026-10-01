import type { AuthUser, UserRole } from "../../shared/auth";
import type { AdminStore, AdminUser } from "../admin/types";
import type { StoreAppointment } from "../agenda/types";
import {
  MOCK_ADMIN_USERS,
  MOCK_AGENDAS,
  MOCK_DATE,
  MOCK_PRESENCES,
  MOCK_STORES,
  MOCK_STORE_APPOINTMENTS,
  MOCK_USERS_BY_ROLE,
  mockAdminAgendaDetail,
  mockAppointmentDetail,
  mockStoreAgenda,
} from "./mockData";

let currentUser: AuthUser | null = MOCK_USERS_BY_ROLE.admin;

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as unknown as T;
}

function bodyAsRecord(init: RequestInit): Record<string, unknown> {
  if (typeof init.body !== "string" || init.body.length === 0) return {};
  try {
    const value = JSON.parse(init.body) as unknown;
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function roleForLogin(login: string): UserRole {
  const normalized = login.trim().toLowerCase();
  if (normalized.includes("conferente")) return "conferente";
  if (normalized.includes("visual")) return "visualizador";
  return "admin";
}

function withDate<T extends { date: string }>(value: T, date: string): T {
  return { ...value, date };
}

function appointmentById(id: string) {
  return (
    MOCK_STORE_APPOINTMENTS.find((appointment) => appointment.id === id) ??
    MOCK_STORE_APPOINTMENTS[0]
  );
}

async function tinyDelay() {
  await new Promise((resolve) => window.setTimeout(resolve, 90));
}

export async function mockApiFetch<T>(
  input: string,
  init: RequestInit = {},
): Promise<T> {
  await tinyDelay();

  const method = (init.method ?? "GET").toUpperCase();
  const url = new URL(input, window.location.origin);
  const path = url.pathname;
  const body = bodyAsRecord(init);

  if (path === "/api/auth/me" && method === "GET") {
    if (!currentUser) throw new Error("Sessão mock encerrada.");
    return clone(currentUser) as unknown as T;
  }

  if (path === "/api/auth/login" && method === "POST") {
    const login = typeof body.login === "string" ? body.login : "admin";
    currentUser = MOCK_USERS_BY_ROLE[roleForLogin(login)];
    return clone(currentUser) as unknown as T;
  }

  if (path === "/api/auth/logout" && method === "POST") {
    currentUser = null;
    return undefined as unknown as T;
  }

  if (path === "/api/auth/bootstrap-status" && method === "GET") {
    return { available: false } as unknown as T;
  }

  if (path === "/api/realtime/config" && method === "GET") {
    return { mode: "off", protocolVersion: 1 } as unknown as T;
  }

  if (path === "/api/admin/presence" && method === "GET") {
    return clone(MOCK_PRESENCES) as unknown as T;
  }

  if (path === "/api/admin/stores" && method === "GET") {
    return clone(MOCK_STORES) as unknown as T;
  }

  if (path === "/api/admin/stores" && method === "POST") {
    const created: AdminStore = {
      id: "store-preview-new",
      codigo: typeof body.codigo === "string" ? body.codigo : "F99",
      nome: typeof body.nome === "string" ? body.nome : "Loja Preview",
      ativo: true,
    };
    return created as unknown as T;
  }

  if (/^\/api\/admin\/stores\/[^/]+$/.test(path) && method === "PATCH") {
    const id = path.split("/").at(-1) ?? "store-preview";
    const base = MOCK_STORES.find((store) => store.id === id) ?? MOCK_STORES[0];
    return {
      ...base,
      ...body,
      id: base.id,
    } as unknown as T;
  }

  if (/^\/api\/admin\/stores\/[^/]+$/.test(path) && method === "DELETE") {
    return undefined as unknown as T;
  }

  if (path === "/api/admin/users" && method === "GET") {
    return clone(MOCK_ADMIN_USERS) as unknown as T;
  }

  if (path === "/api/admin/users" && method === "POST") {
    const papel =
      body.papel === "admin" ||
      body.papel === "conferente" ||
      body.papel === "visualizador"
        ? body.papel
        : "conferente";
    const created: AdminUser = {
      id: "user-preview-new",
      nome: typeof body.nome === "string" ? body.nome : "Usuário Preview",
      login: typeof body.login === "string" ? body.login : "preview",
      papel,
      lojaId: typeof body.lojaId === "string" ? body.lojaId : null,
      ativo: true,
    };
    return created as unknown as T;
  }

  if (/^\/api\/admin\/users\/[^/]+$/.test(path) && method === "PATCH") {
    const id = path.split("/").at(-1) ?? "user-preview";
    const base =
      MOCK_ADMIN_USERS.find((user) => user.id === id) ?? MOCK_ADMIN_USERS[0];
    return {
      ...base,
      ...body,
      id: base.id,
    } as unknown as T;
  }

  if (/^\/api\/admin\/users\/[^/]+$/.test(path) && method === "DELETE") {
    return undefined as unknown as T;
  }

  if (path === "/api/admin/agendas" && method === "GET") {
    const date = url.searchParams.get("date") ?? MOCK_DATE;
    return MOCK_AGENDAS.map((agenda) => withDate(agenda, date)) as unknown as T;
  }

  if (/^\/api\/admin\/agendas\/[^/]+$/.test(path) && method === "GET") {
    const id = path.split("/").at(-1) ?? "";
    return clone(mockAdminAgendaDetail(id)) as unknown as T;
  }

  if (/^\/api\/admin\/agendas\/[^/]+\/status$/.test(path) && method === "PATCH") {
    const agendaId = path.split("/")[4];
    const detail = mockAdminAgendaDetail(agendaId);
    return {
      ...detail.agenda,
      dayStatus: "aberto",
      completedAt: null,
      completedBy: null,
    } as unknown as T;
  }

  if (path === "/api/store/today" && method === "GET") {
    return clone(mockStoreAgenda()) as unknown as T;
  }

  if (/^\/api\/store\/history\/\d{4}-\d{2}-\d{2}$/.test(path) && method === "GET") {
    const date = path.split("/").at(-1) ?? MOCK_DATE;
    return clone(mockStoreAgenda(date)) as unknown as T;
  }

  if (path === "/api/store/presence" && method === "POST") {
    return {
      ok: true,
      recordedAt: new Date().toISOString(),
    } as unknown as T;
  }

  if (path === "/api/store/presence" && method === "DELETE") {
    return undefined as unknown as T;
  }

  if (/^\/api\/store\/appointments\/[^/]+$/.test(path) && method === "GET") {
    const id = path.split("/").at(-1) ?? "";
    return clone(mockAppointmentDetail(id)) as unknown as T;
  }

  if (/^\/api\/store\/appointments\/[^/]+\/status$/.test(path) && method === "PATCH") {
    const id = path.split("/")[4];
    const base = appointmentById(id);
    const status =
      body.status === "aguardando" ||
      body.status === "recebido" ||
      body.status === "nao_chegou" ||
      body.status === "recusado"
        ? body.status
        : base.status;
    return { ...clone(base), status } as unknown as T;
  }

  if (/^\/api\/store\/appointments\/[^/]+\/exchanges$/.test(path) && method === "PATCH") {
    const id = path.split("/")[4];
    const base = appointmentById(id);
    return {
      ...clone(base),
      hasExchanges:
        typeof body.hasExchanges === "boolean"
          ? body.hasExchanges
          : base.hasExchanges,
    } as unknown as T;
  }

  if (/^\/api\/store\/agenda\/\d{4}-\d{2}-\d{2}\/manual$/.test(path) && method === "POST") {
    const supplier =
      typeof body.supplier === "string" ? body.supplier : "Fornecedor Preview";
    const created: StoreAppointment = {
      id: "apt-preview-manual",
      protocol: "SEM-AGENDA-PREVIEW",
      startTime: "11:30",
      endTime: "11:30",
      supplier,
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
    };
    return created as unknown as T;
  }

  if (/^\/api\/store\/appointments\/[^/]+\/manual$/.test(path) && method === "PATCH") {
    const id = path.split("/")[4];
    const base = appointmentById(id);
    return {
      ...clone(base),
      supplier:
        typeof body.supplier === "string" ? body.supplier : base.supplier,
    } as unknown as T;
  }

  if (/^\/api\/store\/appointments\/[^/]+\/manual$/.test(path) && method === "DELETE") {
    return undefined as unknown as T;
  }

  if (/^\/api\/store\/agenda\/\d{4}-\d{2}-\d{2}\/complete$/.test(path) && method === "POST") {
    const date = path.split("/")[4];
    const agenda = mockStoreAgenda(date).agenda;
    if (!agenda) throw new Error("Agenda mock ausente.");
    return {
      ...agenda,
      dayStatus: "concluido",
      completedAt: new Date().toISOString(),
      completedBy: {
        id: "preview-conferente",
        name: "Gabriel Souza",
      },
    } as unknown as T;
  }

  throw new Error(`Endpoint não mockado na preview: ${method} ${path}`);
}
