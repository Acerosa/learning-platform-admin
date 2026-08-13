"use client";

import { getLearningPlatformContent } from "../../vendor/learning-platform-content/0.1.0/engine-bundle.js";
import type { ContentEngine } from "./types";

export function getContentEngine(): ContentEngine {
  const engine = getLearningPlatformContent() as ContentEngine | undefined;
  if (!engine || typeof engine.validatePackage !== "function") {
    throw new Error("Canonical content engine failed to load.");
  }
  return engine;
}

export function implementedBlockTypes() {
  return getContentEngine().BLOCK_TYPES.filter((type) => type.implemented);
}

export function authorableBlockTypes() {
  const engine = getContentEngine();
  return engine.BLOCK_TYPES.filter((type) => type.implemented);
}
