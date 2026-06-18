export function readString(value: unknown) {
  return typeof value === "string" ? value : ""
}

export function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}
