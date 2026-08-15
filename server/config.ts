import type { AppConfig, BaliEnvironment } from "./types.js";

const ENVIRONMENTS = new Set<BaliEnvironment>([
  "demo",
  "development",
  "staging",
  "production",
  "test"
]);

function integer(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const requested = (env.BALI_ENV || env.NODE_ENV || "development") as BaliEnvironment;
  const environment = ENVIRONMENTS.has(requested) ? requested : "development";
  const productionLike = environment === "production" || environment === "staging";
  const config: AppConfig = {
    environment,
    port: integer(env.PORT, 8080),
    databaseUrl: env.DATABASE_URL || "",
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || "",
    telegramBotUrl: env.TELEGRAM_BOT_URL || "",
    sessionSecret: env.SESSION_SECRET || "",
    sessionTtlSeconds: integer(env.SESSION_TTL_SECONDS, 30 * 24 * 60 * 60),
    telegramAuthMaxAgeSeconds: integer(env.TELEGRAM_AUTH_MAX_AGE_SECONDS, 300),
    adminBootstrapEmail: (env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase(),
    adminBootstrapPassword: env.ADMIN_BOOTSTRAP_PASSWORD || "",
    trustProxy: env.TRUST_PROXY === "1",
    secureCookies: productionLike
  };

  if (productionLike) {
    const missing = [
      !config.databaseUrl && "DATABASE_URL",
      config.sessionSecret.length < 32 && "SESSION_SECRET (minimum 32 characters)"
    ].filter(Boolean);
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  }

  return config;
}
