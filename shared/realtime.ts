import type { UserRole } from "./auth";

export const REALTIME_PROTOCOL_VERSION = 1 as const;

export type RealtimeConnectionIdentity = {
  userId: string;
  role: UserRole;
  storeId: string | null;
};

export type RealtimeReadyEvent = {
  version: typeof REALTIME_PROTOCOL_VERSION;
  type: "realtime.ready";
};

export type RealtimeServerEvent = RealtimeReadyEvent;
