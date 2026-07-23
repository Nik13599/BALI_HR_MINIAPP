export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

function hex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array | string, value: string) {
  const raw = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(value));
}

export async function validateTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86400) {
  if (!initData || !botToken) throw new Error("Не получены данные авторизации Telegram");
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  if (!receivedHash) throw new Error("Telegram hash отсутствует");
  params.delete("hash");
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = await hmac("WebAppData", botToken);
  const calculated = hex(await hmac(secret, dataCheckString));
  if (calculated !== receivedHash) throw new Error("Подпись Telegram недействительна");
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Math.floor(Date.now() / 1000) - authDate > maxAgeSeconds) throw new Error("Сессия Telegram устарела");
  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Пользователь Telegram не найден");
  const user = JSON.parse(userRaw) as TelegramUser;
  if (!user?.id) throw new Error("Telegram ID не найден");
  return { user, authDate, queryId: params.get("query_id") || "", startParam: params.get("start_param") || "" };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" } });
}