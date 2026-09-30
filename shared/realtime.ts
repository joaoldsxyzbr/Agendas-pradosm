import type { UserRole } from "./auth";

export const REALTIME_PROTOCOL_VERSION = 1 as const;

export type RealtimeMode = "off" | "shadow" | "on";
export type RealtimePresenceStatus = "online" | "away" | "offline";

export type RealtimeConfig = {
  mode: RealtimeMode;
  protocolVersion: typeof REALTIME_PROTOCOL_VERSION;
};

export type RealtimeConnectionIdentity = {
  userId: string;
  role: UserRole;
  storeId: string | null;
};

export type RealtimeReadyEvent = {
  version: typeof REALTIME_PROTOCOL_VERSION;
  type: "realtime.ready";
};

export type RealtimePresenceChangedEvent = {
  version: typeof REALTIME_PROTOCOL_VERSION;
  type: "presence.changed";
  storeId: string;
  status: RealtimePresenceStatus;
};

export type RealtimePresenceSnapshotEvent = {
  version: typeof REALTIME_PROTOCOL_VERSION;
  type: "presence.snapshot";
  stores: Array<{
    storeId: string;
    status: RealtimePresenceStatus;
  }>;
};

export type RealtimeAgendaChangedReason =
  | "status"
  | "exchanges"
  | "manual"
  | "day-status"
  | "import";

export type RealtimeAgendaChangedEvent = {
  version: typeof REALTIME_PROTOCOL_VERSION;
  type: "agenda.changed";
  agendaId: string;
  storeId: string;
  date: string;
  reason: RealtimeAgendaChangedReason;
};

export type RealtimeServerEvent =
  | RealtimeReadyEvent
  | RealtimePresenceChangedEvent
  | RealtimePresenceSnapshotEvent
  | RealtimeAgendaChangedEvent;

export type RealtimePresenceSetMessage = {
  version: typeof REALTIME_PROTOCOL_VERSION;
  type: "presence.set";
  status: Exclude<RealtimePresenceStatus, "offline">;
};

export type RealtimePresenceHeartbeatMessage = {
  version: typeof REALTIME_PROTOCOL_VERSION;
  type: "presence.heartbeat";
};

export type RealtimeClientMessage =
  | RealtimePresenceSetMessage
  | RealtimePresenceHeartbeatMessage;
