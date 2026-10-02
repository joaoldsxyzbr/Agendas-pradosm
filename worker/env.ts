import type { AuthUser } from "../shared/auth";

export type LoginRateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type WorkerEnv = {
  DB: D1Database;
  SESSION_SECRET: string;
  LOGIN_RATE_LIMITER?: LoginRateLimiter;
  REALTIME_HUB: DurableObjectNamespace;
  REALTIME_MODE?: string;
};

export type AppEnv = {
  Bindings: WorkerEnv;
  Variables: {
    authUser: AuthUser;
    sessionExpiresAt: number;
  };
};
