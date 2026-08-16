import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  webcrypto
} from "node:crypto";
import { promisify } from "node:util";
import type { TelegramUser } from "./types.js";

const scrypt = promisify(scryptCallback);
const PBKDF2_ALGORITHM = "pbkdf2-sha256";
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_BYTES = 32;
const encoder = new TextEncoder();

function cryptoSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle || webcrypto.subtle;
  if (!subtle) throw new Error("Web Crypto API is unavailable");
  return subtle;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number, bytes: number): Promise<Uint8Array> {
  const subtle = cryptoSubtle();
  const key = await subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    bytes * 8
  );
  return new Uint8Array(bits);
}

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
  const derived = await pbkdf2(password, salt, PBKDF2_ITERATIONS, PBKDF2_BYTES);
  return `${PBKDF2_ALGORITHM}:${PBKDF2_ITERATIONS}:${salt.toString("base64url")}:${Buffer.from(derived).toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = String(encoded || "").split(":");
  if (parts[0] === PBKDF2_ALGORITHM) {
    const iterations = Number(parts[1]);
    const saltText = parts[2];
    const hashText = parts[3];
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000 || !saltText || !hashText) return false;
    const expected = Buffer.from(hashText, "base64url");
    if (!expected.length) return false;
    const derived = await pbkdf2(password, Buffer.from(saltText, "base64url"), iterations, expected.length);
    const actual = Buffer.from(derived);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  const [algorithm, saltText, hashText] = parts;
  if (algorithm !== "scrypt" || !saltText || !hashText) return false;
  try {
    const expected = Buffer.from(hashText, "base64url");
    const derived = await scrypt(password, Buffer.from(saltText, "base64url"), expected.length) as Buffer;
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
