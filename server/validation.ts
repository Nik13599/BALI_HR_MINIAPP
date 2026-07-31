import { ApiError } from "./errors.js";

export function requiredText(value: unknown, field: string, maxLength: number, minLength = 1): string {
  const text = String(value ?? "").trim();
  if (text.length < minLength || text.length > maxLength) {
    throw new ApiError(400, `${field} must contain ${minLength}-${maxLength} characters`, "validation_error");
  }
  return text;
}

export function optionalText(value: unknown, maxLength: number): string {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw new ApiError(400, `Text is longer than ${maxLength} characters`, "validation_error");
  return text;
}

export function uuid(value: unknown, field = "id"): string {
  const text = String(value || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new ApiError(400, `${field} is invalid`, "validation_error");
  }
  return text;
}

export function identifier(value: unknown, field = "id"): string {
  const text = String(value || "").trim();
  if (!/^[a-zA-Z0-9:_-]{1,160}$/.test(text)) throw new ApiError(400, `${field} is invalid`, "validation_error");
  return text;
}

export function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, `Value must be an integer from ${min} to ${max}`, "validation_error");
  }
  return parsed;
}

export function booleanValue(value: unknown, fallback = false): boolean {
  if (value === undefined) return fallback;
  if (value === true || value === false) return value;
  throw new ApiError(400, "Value must be a boolean", "validation_error");
}

export function enumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[]
): T {
  const text = String(value ?? "").trim() as T;
  if (!allowed.includes(text)) {
    throw new ApiError(400, `${field} must be one of: ${allowed.join(", ")}`, "validation_error");
  }
  return text;
}

export function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, `Value must be a number from ${min} to ${max}`, "validation_error");
  }
  return parsed;
}

export function uniqueStrings(value: unknown, field: string, min: number, max: number, itemMax = 200): string[] {
  if (!Array.isArray(value)) throw new ApiError(400, `${field} must be an array`, "validation_error");
  const rows = [...new Set(value.map(item => requiredText(item, field, itemMax)))];
  if (rows.length < min || rows.length > max) {
    throw new ApiError(400, `${field} must contain ${min}-${max} unique values`, "validation_error");
  }
  return rows;
}

export function isoDateOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Invalid date", "validation_error");
  return date.toISOString();
}
