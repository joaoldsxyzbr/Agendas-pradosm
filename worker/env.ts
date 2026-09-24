import type { AuthUser } from "../shared/auth";

export type WorkerEnv = {
  DB: D1Database;
  SESSION_SECRET: string;
};

export type AppEnv = {
  Bindings: WorkerEnv;
  Variables: {
    authUser: AuthUser;
  };
};
