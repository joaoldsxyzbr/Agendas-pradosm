import type { AuthUser } from "../shared/auth.ts";

export interface Env {
  DB: D1Database;
  SESSION_SECRET: string;
  REALTIME_MODE: string;
  REALTIME_HUB: DurableObjectNamespace;
  LOGIN_RATE_LIMITER: RateLimit;
  ASSETS: Fetcher;
}

export interface AppEnv {
  Bindings: Env;
  Variables: {
    authUser?: AuthUser;
    sessionExpiresAt?: number;
  };
}
