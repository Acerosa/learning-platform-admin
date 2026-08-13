import type { ContentPackage } from "./types";

export function clonePackage(pkg: ContentPackage): ContentPackage {
  return structuredClone(pkg);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as object)) {
      deepFreeze(nested);
    }
  }
  return value;
}
