import { one, transaction } from "./db.js";
import { ApiError } from "./errors.js";
import type { Queryable } from "./types.js";

export interface PointMutation {
  userKey: string;
  amount: number;
  operationType: "credit" | "debit" | "refund" | "reversal" | "adjustment";
  sourceType: string;
  sourceId?: string;
  reason?: string;
  idempotencyKey: string;
  administratorId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function mutatePoints(db: Queryable, input: PointMutation): Promise<any> {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
    throw new ApiError(400, "Point amount must be a non-zero safe integer", "validation_error");
  }
  return transaction(db, async client => {
    const replay = await one<any>(
      client,
      `select * from public.point_ledger where idempotency_key = $1`,
      [input.idempotencyKey]
    );
    if (replay) {
      if (replay.user_key !== input.userKey || Number(replay.amount) !== input.amount) {
        throw new ApiError(409, "Idempotency key was already used for another operation", "idempotency_conflict");
      }
      return { ledger: replay, replayed: true };
    }
    await client.query(
      `insert into public.point_accounts(user_key)
       values ($1)
       on conflict (user_key) do nothing`,
      [input.userKey]
    );
    const account = await one<any>(
      client,
      `select * from public.point_accounts where user_key = $1 for update`,
      [input.userKey]
    );
    const balanceBefore = Number(account?.balance || 0);
    const balanceAfter = balanceBefore + input.amount;
    if (balanceAfter < 0) {
      throw new ApiError(409, "Not enough BALI points", "insufficient_points", {
        balance: balanceBefore,
        required: Math.abs(input.amount)
      });
    }
    await client.query(
      `update public.point_accounts
          set balance = $2,
              lifetime_earned = lifetime_earned + case when $3 > 0 then $3 else 0 end,
              lifetime_spent = lifetime_spent + case when $3 < 0 then -$3 else 0 end,
              version = version + 1,
              updated_at = now()
        where user_key = $1`,
      [input.userKey, balanceAfter, input.amount]
    );
    const ledger = await one<any>(
      client,
      `insert into public.point_ledger(
         user_key, amount, balance_before, balance_after, operation_type,
         source_type, source_id, reason, administrator_id, idempotency_key, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       returning *`,
      [
        input.userKey,
        input.amount,
        balanceBefore,
        balanceAfter,
        input.operationType,
        input.sourceType,
        input.sourceId || "",
        input.reason || "",
        input.administratorId || null,
        input.idempotencyKey,
        JSON.stringify(input.metadata || {})
      ]
    );
    return { ledger, replayed: false };
  });
}
