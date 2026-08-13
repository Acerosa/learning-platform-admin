const SCRIPT = /<\s*script/i;
const EVENT_ATTR = /\son[a-z]+\s*=/i;
const JS_URL = /^\s*javascript:/i;

export function containsUnsafeMarkup(value: string) {
  return SCRIPT.test(value) || EVENT_ATTR.test(value) || JS_URL.test(value);
}

export function sanitizeImportedText(value: unknown) {
  const text = String(value == null ? "" : value);
  if (containsUnsafeMarkup(text)) {
    const error = new Error("Imported content contains disallowed HTML or script.");
    (error as Error & { code?: string }).code = "UNSAFE_CONTENT";
    throw error;
  }
  return text;
}

export function sanitizeObject(value: unknown): unknown {
  if (typeof value === "string") return sanitizeImportedText(value);
  if (Array.isArray(value)) return value.map(sanitizeObject);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, sanitizeObject(nested)]),
    );
  }
  return value;
}
