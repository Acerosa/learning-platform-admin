import { getContentEngine } from "./engine.ts";

export function containsUnsafeMarkup(value: string) {
  return getContentEngine().containsUnsafeMarkup(value);
}

export function sanitizeImportedText(value: unknown) {
  return getContentEngine().sanitizeImportedText(value);
}

export function sanitizeObject(value: unknown): unknown {
  return getContentEngine().sanitiseContent(value);
}
