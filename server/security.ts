import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
import type { TelegramUser } from "./types.js";

const scrypt = promisify(scryptCallback);

export class AuthenticationError extends Error {
  status = 401;
}

export function hashToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function parseCookies(raw = ""): Record<string, string> {
  return Object.fromEntries(
    raw.split(";").map(part => part.trim()).filter(Boolean).map(part => {
      const separator = part.indexOf("=");
      if (separator < 0) return [part, ""];
      return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
    })
  );
}

export interface VerifiedTelegramData {
  user: TelegramUser;
  authDate: number;
  queryId?: string;
  startParam?: string;
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): VerifiedTelegramData {
  if (!initData || !botToken) throw new AuthenticationError("Telegram authentication is unavailable");
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  params.delete("hash");
  params.delete("signature");
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) throw new AuthenticationError("Invalid Telegram signature");

  const dataCheckString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const receivedBuffer = Buffer.from(receivedHash, "hex");
  if (receivedBuffer.length !== expectedHash.length || !timingSafeEqual(receivedBuffer, expectedHash)) {
    throw new AuthenticationError("Invalid Telegram signature");
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!Number.isInteger(authDate) || authDate <= 0) throw new AuthenticationError("Invalid Telegram auth date");
  const age = nowSeconds - authDate;
  if (age < -30 || age > maxAgeSeconds) throw new AuthenticationError("Telegram authentication expired");

  let user: TelegramUser;
  try {
    user = JSON.parse(params.get("user") || "");
  } catch {
    throw new AuthenticationError("Invalid Telegram user payload");
  }
  if (!Number.isSafeInteger(user?.id) || user.id <= 0 || !String(user.first_name || "").trim()) {
    throw new AuthenticationError("Invalid Telegram user payload");
  }

  return {
    user,
    authDate,
    queryId: params.get("query_id") || undefined,
    startParam: params.get("start_param") || undefined
  };
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("Administrator password must contain at least 12 characters");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltText, hashText] = String(encoded || "").split(":");
  if (algorithm !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const derived = await scrypt(password, Buffer.from(saltText, "base64url"), expected.length) as Buffer;
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
