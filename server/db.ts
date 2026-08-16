import pg from "pg";
import type { PoolClient, QueryResultRow } from "pg";
import type { Queryable } from "./types.js";

export function createPool(databaseUrl: string): pg.Pool {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const configuredMax = Number.parseInt(process.env.DB_POOL_MAX || "", 10);
  const max = Number.isFinite(configuredMax) && configuredMax > 0
    ? configuredMax
    : process.env.VERCEL
      ? 1
      : 10;
  return new pg.Pool({
    connectionString: databaseUrl,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: /sslmode=require/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined
  });
}

export async function one<T extends QueryResultRow = any>(
  db: Queryable,
  text: string,
  values: readonly unknown[] = []
): Promise<T | null> {
  const result = await db.query<T>(text, values);
  return result.rows[0] || null;
}

export async function many<T extends QueryResultRow = any>(
  db: Queryable,
  text: string,
  values: readonly unknown[] = []
): Promise<T[]> {
  return (await db.query<T>(text, values)).rows;
}

export async function transaction<T>(
  db: Queryable,
  callback: (client: Queryable) => Promise<T>
): Promise<T> {
  if (!db.connect) return callback(db);
  const client: PoolClient = await db.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
