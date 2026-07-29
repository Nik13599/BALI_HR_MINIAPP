import type { QueryResult, QueryResultRow } from "pg";

export type BaliEnvironment = "demo" | "development" | "staging" | "production" | "test";

export interface AppConfig {
  environment: BaliEnvironment;
  port: number;
  databaseUrl: string;
  telegramBotToken: string;
  telegramBotUrl: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  telegramAuthMaxAgeSeconds: number;
  adminBootstrapEmail: string;
  adminBootstrapPassword: string;
  trustProxy: boolean;
  secureCookies: boolean;
}

export interface Queryable {
  query<R extends QueryResultRow = any>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<R>>;
  connect?: () => Promise<any>;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
}

export interface UserPrincipal {
  kind: "user";
  userKey: string;
  telegramUserId: string;
  sessionId: string;
  name: string;
  username: string;
  status: string;
}

export interface AdminPrincipal {
  kind: "admin";
  adminId: string;
  sessionId: string;
  email: string;
  role: string;
  status: string;
}

export interface PermissionDecision {
  allowed: boolean;
  source: "admin" | "leader" | "grant" | "member" | "denied" | "none";
  membership?: Record<string, any>;
  chat?: Record<string, any>;
  restriction?: Record<string, any> | null;
}

declare module "express-serve-static-core" {
  interface Request {
    requestId: string;
    userPrincipal?: UserPrincipal;
    adminPrincipal?: AdminPrincipal;
    permissionDecision?: PermissionDecision;
  }
}
