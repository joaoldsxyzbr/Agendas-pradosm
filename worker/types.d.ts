// Tipos ambientais do runtime Cloudflare Workers usados pelo Worker.
// Subconjunto das APIs efetivamente usadas; sem dependências externas.

interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: Record<string, unknown>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface RateLimitOutcome {
  success: boolean;
}

interface RateLimit {
  limit(options: { key: string }): Promise<RateLimitOutcome>;
}

interface DurableObjectStorage {
  getAlarm(): Promise<number | null>;
  setAlarm(timestamp: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

interface DurableObjectState {
  storage: DurableObjectStorage;
  setWebSocketAutoResponse(pair: WebSocketRequestResponsePair): void;
  getWebSocketAutoResponseTimestamp(ws: WebSocket): Date | null;
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
}

interface DurableObjectId {}

interface DurableObjectStub {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  idFromHex(hex: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface Fetcher {
  fetch(input: Request | string, init?: RequestInit): Promise<Response>;
}

interface ScheduledController {
  scheduledTime: number;
  cron: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

interface WebSocketRequestResponsePair {}

interface WebSocket {
  serializeAttachment(data: unknown): void;
  deserializeAttachment(): any;
}

interface ResponseInit {
  webSocket?: unknown;
}

declare var WebSocketPair: { new (): { [key: string]: WebSocket } };
declare var WebSocketRequestResponsePair: {
  new (request: string, response: string): WebSocketRequestResponsePair;
};

declare module "cloudflare:workers" {
  export class DurableObject {
    protected readonly ctx: DurableObjectState;
    protected readonly env: unknown;
    constructor(ctx: DurableObjectState, env: unknown);
    fetch(request: Request): Response | Promise<Response>;
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>;
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean?: boolean): void | Promise<void>;
    webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>;
    alarm?(): void | Promise<void>;
  }
}

declare module "@llamaindex/liteparse-wasm" {
  export default function initLiteParse(): unknown;
  export class LiteParse {
    constructor(options?: Record<string, unknown>);
    parse(bytes: Uint8Array): Promise<any>;
  }
}
